for (const url of [
  "http://localhost:4000/api/v1/ready",
  "http://localhost:3000/kk",
]) {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error(`Not ready: ${url}`);
}
console.log("API and frontend ready");
