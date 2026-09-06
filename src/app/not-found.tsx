import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-neutral-400">That project doesn&apos;t exist in the warehouse.</p>
      <Link href="/" className="mt-4 inline-block text-emerald-400 hover:text-emerald-300">
        ← Back to warehouse
      </Link>
    </div>
  );
}
