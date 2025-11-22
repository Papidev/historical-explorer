import {RomeMap} from "@/app/components/RomeMap";

export default function RomePage() {
    return (
        <main className="flex flex-col h-screen">
            <header className="p-4">
                <h1 className="text-xl font-bold">Historical Explorer – Rome</h1>
                <p className="text-sm opacity-80">A simple starting point: a map centered on Rome.</p>
            </header>

            <section className="flex-1 min-h-0">
                <RomeMap />
            </section>
        </main>
    );
}
