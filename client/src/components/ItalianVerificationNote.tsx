export function italianVerificationText(verified: boolean): string {
  return verified
    ? 'Doppiaggio e sottotitoli IT verificati.'
    : 'Doppiaggio e sottotitoli IT non sono verificati.';
}

export function ItalianVerificationNote({ verified }: { verified: boolean }) {
  return <p className="text-xs text-gray-500">{italianVerificationText(verified)}</p>;
}
