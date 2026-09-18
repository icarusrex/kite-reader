let current: HTMLAudioElement | null = null;
let token = 0;

/** Generic text speech for modules that do not need Reading's phoneme/prompt system. */
export function stopSpeech() {
  token += 1;
  if (current) {
    current.pause();
    current = null;
  }
}

export async function speakText(text: string): Promise<void> {
  stopSpeech();
  const mine = token;
  const audio = new Audio(`/api/say?text=${encodeURIComponent(text)}`);
  current = audio;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (current === audio) current = null;
      resolve();
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
    window.setTimeout(finish, 12000);
  });
  if (mine !== token && current === audio) current = null;
}
