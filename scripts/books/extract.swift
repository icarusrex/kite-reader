// macOS-only helper for scripts/books/build.ts: renders page pictures and OCRs text with Apple Vision.
// Reads a JSON array of jobs on stdin, writes one JSON result per job to stdout.
//   job: { out: "page.jpg", picture: [{file} | {pdf, page}], ocr: [{file} | {pdf, page}] }
//   Several picture sources are joined side by side (two-page spreads).
//   result: { out, width, height, lines: [string] }
// `extract pages <file.pdf>` prints the page count; `extract text <file.pdf>` prints each page's text.
import AppKit
import PDFKit
import Vision

struct Source: Decodable { let file: String?; let pdf: String?; let page: Int?; let rightHalf: Bool? }
struct Job: Decodable { let out: String?; let picture: [Source]?; let ocr: [Source]; let maxWidth: Int?; let quality: Double? }
struct Result: Encodable { let out: String?; let width: Int; let height: Int; let lines: [String] }

var pdfs: [String: PDFDocument] = [:]

func cgImage(_ s: Source) -> CGImage? {
  guard let img = loadImage(s) else { return nil }
  return s.rightHalf == true ? img.cropping(to: CGRect(x: img.width / 2, y: 0, width: img.width - img.width / 2, height: img.height)) : img
}

func loadImage(_ s: Source) -> CGImage? {
  if let f = s.file {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: f) as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
  }
  guard let p = s.pdf, let n = s.page else { return nil }
  let doc = pdfs[p] ?? PDFDocument(url: URL(fileURLWithPath: p))!
  pdfs[p] = doc
  guard let page = doc.page(at: n) else { return nil }
  let box = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2400 / max(box.width, box.height)
  let w = Int(box.width * scale), h = Int(box.height * scale)
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.setFillColor(.white); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  return ctx.makeImage()
}

/// Lines in reading order: top to bottom, and left page before right page on spreads.
func ocr(_ img: CGImage) -> [String] {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = true
  req.recognitionLanguages = ["en-US"]
  try? VNImageRequestHandler(cgImage: img).perform([req])
  let obs = (req.results ?? []).compactMap { o -> (CGRect, String)? in
    guard let c = o.topCandidates(1).first, c.confidence > 0.3 else { return nil }
    return (o.boundingBox, c.string)
  }
  let spread = img.width > img.height * 5 / 4
  return obs.sorted { a, b in
    if spread { let la = a.0.midX < 0.5, lb = b.0.midX < 0.5; if la != lb { return la } }
    if abs(a.0.midY - b.0.midY) > 0.02 { return a.0.midY > b.0.midY }
    return a.0.minX < b.0.minX
  }.map { $0.1 }
}

/// Join images left to right at a common height.
func sideBySide(_ imgs: [CGImage]) -> CGImage? {
  guard imgs.count > 1 else { return imgs.first }
  let h = imgs.map(\.height).max()!
  let widths = imgs.map { Int(CGFloat($0.width) * CGFloat(h) / CGFloat($0.height)) }
  let ctx = CGContext(data: nil, width: widths.reduce(0, +), height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  var x = 0
  for (img, w) in zip(imgs, widths) { ctx.draw(img, in: CGRect(x: x, y: 0, width: w, height: h)); x += w }
  return ctx.makeImage()
}

func writeJpeg(_ img: CGImage, _ path: String, maxW: Int = 1400, quality: Double = 0.78) -> (Int, Int) {
  let scale = min(1, CGFloat(maxW) / CGFloat(img.width))
  let w = Int(CGFloat(img.width) * scale), h = Int(CGFloat(img.height) * scale)
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
  try! rep.representation(using: .jpeg, properties: [.compressionFactor: quality])!.write(to: URL(fileURLWithPath: path))
  return (w, h)
}

if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "pages" {
  print(PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[2]))?.pageCount ?? 0)
  exit(0)
}
// `extract text <file.pdf>`: the PDF's own text per page, as a JSON array (for books made digitally)
if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "text" {
  let d = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[2]))
  let pages = (0..<(d?.pageCount ?? 0)).map { d?.page(at: $0)?.string ?? "" }
  print(String(data: try JSONSerialization.data(withJSONObject: pages), encoding: .utf8)!)
  exit(0)
}

let jobs = try JSONDecoder().decode([Job].self, from: FileHandle.standardInput.readDataToEndOfFile())
let enc = JSONEncoder()
for job in jobs {
  var size = (0, 0)
  if let p = job.picture, let out = job.out, let img = sideBySide(p.compactMap(cgImage)) { size = writeJpeg(img, out, maxW: job.maxWidth ?? 1400, quality: job.quality ?? 0.78) }
  let lines = job.ocr.compactMap(cgImage).flatMap(ocr)
  print(String(data: try enc.encode(Result(out: job.out, width: size.0, height: size.1, lines: lines)), encoding: .utf8)!)
  fflush(stdout)
}
