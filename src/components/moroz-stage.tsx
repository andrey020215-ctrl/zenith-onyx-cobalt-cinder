import { useState } from "react";
import pluginSource from "../../plugin/Moroz/MorozPlugin.cs?raw";
import projectSource from "../../plugin/Moroz/Moroz.csproj?raw";
import readmeSource from "../../plugin/Moroz/README.md?raw";
import configSource from "../../plugin/Moroz/example-config/Moroz.json?raw";
import { zipStore } from "@/lib/zip-store";

const FLAKES = [
  { left: 6, delay: 0, duration: 16, size: 2, fade: 0.35 },
  { left: 14, delay: 3, duration: 19, size: 3, fade: 0.22 },
  { left: 23, delay: 1, duration: 13, size: 2, fade: 0.4 },
  { left: 31, delay: 6, duration: 18, size: 2, fade: 0.28 },
  { left: 42, delay: 2, duration: 15, size: 3, fade: 0.2 },
  { left: 53, delay: 4, duration: 21, size: 2, fade: 0.33 },
  { left: 61, delay: 1.5, duration: 14, size: 2, fade: 0.25 },
  { left: 70, delay: 7, duration: 17, size: 3, fade: 0.18 },
  { left: 78, delay: 2.5, duration: 12, size: 2, fade: 0.38 },
  { left: 86, delay: 5, duration: 20, size: 2, fade: 0.24 },
  { left: 93, delay: 0.8, duration: 15, size: 3, fade: 0.16 },
  { left: 48, delay: 8, duration: 18, size: 2, fade: 0.3 },
];

function Digits({ value }: { value: number }) {
  const text = String(value).padStart(2, "0");
  return (
    <span className="inline-flex tabular-nums text-2xl font-semibold tracking-tight text-fg">
      {text.split("").map((digit, index) => (
        <span className="digit" key={`${index}-${digit}`}>
          {digit}
        </span>
      ))}
    </span>
  );
}

export function MorozStage() {
  const [ct, setCt] = useState(0);
  const [terror, setTerror] = useState(0);
  const [flash, setFlash] = useState<"ct" | "t" | null>(null);
  const [open, setOpen] = useState(false);

  function score(team: "ct" | "t") {
    if (team === "ct") setCt((value) => value + 1);
    else setTerror((value) => value + 1);
    setFlash(team);
  }

  function download() {
    const blob = zipStore([
      { name: "Moroz/Moroz.csproj", text: projectSource },
      { name: "Moroz/MorozPlugin.cs", text: pluginSource },
      { name: "Moroz/README.md", text: readmeSource },
      { name: "Moroz/example-config/Moroz.json", text: configSource },
    ]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Moroz.zip";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted uppercase">CS2</p>
          <h1 className="font-sans text-xl font-semibold tracking-tight">Мороз</h1>
        </div>
        <button
          type="button"
          onClick={download}
          className="min-h-11 rounded-md bg-ice px-4 text-sm font-semibold text-ice-ink transition-opacity duration-150 hover:opacity-90"
        >
          Скачать плагин
        </button>
      </header>

      <div className="winter-view mx-4 mb-4 flex flex-1 sm:mx-6">
        <img src="/winter-field.jpg" alt="" />
        <div className="winter-shade" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {FLAKES.map((flake) => (
            <span
              key={flake.left}
              className="flake absolute top-0 rounded-full bg-fg"
              style={{
                left: `${flake.left}%`,
                width: flake.size,
                height: flake.size,
                opacity: flake.fade,
                animationDuration: `${flake.duration}s`,
                animationDelay: `${flake.delay}s`,
              }}
            />
          ))}
        </div>

        <div
          className="pointer-events-none absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <span className="absolute top-1/2 left-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70" />
          <span className="absolute top-1/2 right-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70" />
          <span className="absolute top-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70" />
        </div>

        <div className="absolute inset-x-4 top-5 mx-auto max-w-sm">
          <div className="plaque" aria-live="polite" aria-label={`CT ${ct}, T ${terror}`}>
            <span className="text-xs font-semibold tracking-widest text-ice">CT</span>
            <span className="relative">
              <Digits value={ct} />
              {flash === "ct" ? (
                <span key={ct} className="plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice">
                  +1
                </span>
              ) : null}
            </span>
            <span className="plaque-mark" aria-hidden="true" />
            <span className="relative">
              <Digits value={terror} />
              {flash === "t" ? (
                <span key={terror} className="plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice">
                  +1
                </span>
              ) : null}
            </span>
            <span className="text-xs font-semibold tracking-widest text-ice">T</span>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-4 px-4 pb-6 sm:px-6">
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted">
          Отдельный плагин для зимнего сервера. Считает убийства CT и T и держит такую плашку сверху экрана — компактно, без чата.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => score("ct")}
            className="min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg"
          >
            Фраг CT
          </button>
          <button
            type="button"
            onClick={() => score("t")}
            className="min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg"
          >
            Фраг T
          </button>
          <button
            type="button"
            onClick={() => {
              setCt(0);
              setTerror(0);
              setFlash(null);
            }}
            className="min-h-11 rounded-sm px-4 text-sm font-medium text-muted"
          >
            Сброс
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="self-start text-sm font-medium text-ice"
          aria-expanded={open}
        >
          {open ? "Скрыть установку" : "Как поставить на сервер"}
        </button>
        {open ? (
          <ol className="max-w-xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-pretty text-muted">
            <li>На сервере уже стоят Metamod и CounterStrikeSharp, на компьютере — .NET 8.</li>
            <li>Распакуйте архив и в папке Moroz выполните сборку Release.</li>
            <li>
              В plugins/Moroz положите только Moroz.dll, Moroz.deps.json и Moroz.pdb. Файл API туда не копируйте.
            </li>
            <li>Высоту плашки потом крутите полем Up в конфиге. Игроки прячут её командой !moroz.</li>
          </ol>
        ) : null}
      </footer>
    </div>
  );
}
