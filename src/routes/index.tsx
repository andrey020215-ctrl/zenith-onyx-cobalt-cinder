import { createFileRoute } from "@tanstack/react-router";
import { MorozStage } from "@/components/moroz-stage";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Мороз — счётчик убийств для CS2" },
      {
        name: "description",
        content: "Плагин CounterStrikeSharp: убийства CT и T компактной плашкой сверху экрана, в зимнем стиле.",
      },
    ],
  }),
});

function Home() {
  return <MorozStage />;
}
