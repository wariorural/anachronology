import Link from "next/link";

export default function NotFound() {
  return (
    <main className="tm-feil">
      <h1>This year doesn&apos;t exist</h1>
      <p>At least not on this timeline.</p>
      <Link href="/">Jump to NOW →</Link>
    </main>
  );
}
