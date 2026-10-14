import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CoGMPqCC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MorozPlugin_default = "using CounterStrikeSharp.API;\nusing CounterStrikeSharp.API.Core;\nusing CounterStrikeSharp.API.Core.Attributes;\nusing CounterStrikeSharp.API.Core.Attributes.Registration;\nusing CounterStrikeSharp.API.Modules.Admin;\nusing CounterStrikeSharp.API.Modules.Commands;\nusing CounterStrikeSharp.API.Modules.Utils;\n\nnamespace Moroz;\n\npublic sealed class MorozConfig : BasePluginConfig\n{\n    public float Forward { get; set; } = 8f;\n    public float Up { get; set; } = 2.7f;\n    public float Right { get; set; } = 0f;\n    public float FontSize { get; set; } = 32f;\n    public float UnitsPerPixel { get; set; } = 0.01f;\n    public string FontName { get; set; } = \"Arial\";\n    public bool ResetEachRound { get; set; }\n    public bool CountTeamKills { get; set; }\n    public bool Background { get; set; } = true;\n    public int Red { get; set; } = 214;\n    public int Green { get; set; } = 232;\n    public int Blue { get; set; } = 242;\n}\n\n[MinimumApiVersion(80)]\npublic sealed class MorozPlugin : BasePlugin, IPluginConfig<MorozConfig>\n{\n    public override string ModuleName => \"Мороз\";\n    public override string ModuleVersion => \"1.0.0\";\n    public override string ModuleAuthor => \"Мороз\";\n    public override string ModuleDescription => \"Компактный зимний счётчик убийств CT и T сверху экрана.\";\n\n    public MorozConfig Config { get; set; } = new();\n\n    private readonly CPointWorldText?[] _plates = new CPointWorldText?[64];\n    private readonly string[] _shown = new string[64];\n    private readonly bool[] _hidden = new bool[64];\n    private int _ct;\n    private int _t;\n\n    public void OnConfigParsed(MorozConfig config)\n    {\n        config.Forward = Math.Clamp(config.Forward, 4f, 24f);\n        config.Up = Math.Clamp(config.Up, 0.4f, 8f);\n        config.Right = Math.Clamp(config.Right, -6f, 6f);\n        config.FontSize = Math.Clamp(config.FontSize, 12f, 96f);\n        config.UnitsPerPixel = Math.Clamp(config.UnitsPerPixel, 0.004f, 0.05f);\n        config.Red = Math.Clamp(config.Red, 0, 255);\n        config.Green = Math.Clamp(config.Green, 0, 255);\n        config.Blue = Math.Clamp(config.Blue, 0, 255);\n        if (string.IsNullOrWhiteSpace(config.FontName))\n            config.FontName = \"Arial\";\n        Config = config;\n    }\n\n    public override void Load(bool hotReload)\n    {\n        RegisterListener<Listeners.OnTick>(OnTick);\n        RegisterListener<Listeners.CheckTransmit>(OnTransmit);\n        RegisterListener<Listeners.OnMapStart>(OnMapStart);\n        RegisterListener<Listeners.OnClientDisconnect>(OnDisconnect);\n\n        if (hotReload)\n            AddTimer(0.5f, EnsureEveryone);\n    }\n\n    public override void Unload(bool hotReload)\n    {\n        for (var slot = 0; slot < _plates.Length; slot++)\n            Destroy(slot);\n    }\n\n    [GameEventHandler]\n    public HookResult OnSpawn(EventPlayerSpawn @event, GameEventInfo info)\n    {\n        var player = @event.Userid;\n        if (!AliveHuman(player))\n            return HookResult.Continue;\n\n        AddTimer(0.35f, () =>\n        {\n            if (player is { IsValid: true })\n                Ensure(player);\n        });\n        return HookResult.Continue;\n    }\n\n    [GameEventHandler]\n    public HookResult OnDeath(EventPlayerDeath @event, GameEventInfo info)\n    {\n        var attacker = @event.Attacker;\n        var victim = @event.Userid;\n        if (attacker == null || !attacker.IsValid || attacker.IsHLTV || attacker == victim)\n            return HookResult.Continue;\n        if (attacker.Team is not (CsTeam.Terrorist or CsTeam.CounterTerrorist))\n            return HookResult.Continue;\n        if (!Config.CountTeamKills && victim != null && victim.IsValid && victim.Team == attacker.Team)\n            return HookResult.Continue;\n\n        if (attacker.Team == CsTeam.CounterTerrorist)\n            _ct++;\n        else\n            _t++;\n\n        return HookResult.Continue;\n    }\n\n    [GameEventHandler]\n    public HookResult OnRoundStart(EventRoundStart @event, GameEventInfo info)\n    {\n        if (Config.ResetEachRound)\n        {\n            _ct = 0;\n            _t = 0;\n            Array.Clear(_shown);\n        }\n\n        AddTimer(0.5f, EnsureEveryone);\n        return HookResult.Continue;\n    }\n\n    [ConsoleCommand(\"css_moroz\", \"Скрыть или показать зимний счётчик\")]\n    public void OnToggle(CCSPlayerController? player, CommandInfo command)\n    {\n        if (player == null || !player.IsValid)\n            return;\n        var slot = player.Slot;\n        if ((uint)slot >= 64)\n            return;\n\n        _hidden[slot] = !_hidden[slot];\n        if (_hidden[slot])\n        {\n            Destroy(slot);\n            Say(player, \"Счётчик скрыт. Ещё раз !moroz — вернуть.\");\n            return;\n        }\n\n        Ensure(player);\n        Say(player, \"Счётчик снова сверху.\");\n    }\n\n    [ConsoleCommand(\"css_morozreset\", \"Обнулить счёт убийств CT и T\")]\n    public void OnReset(CCSPlayerController? player, CommandInfo command)\n    {\n        if (player != null && !AdminManager.PlayerHasPermissions(player, \"@css/generic\"))\n        {\n            Say(player, \"Обнулить может только админ.\");\n            return;\n        }\n\n        _ct = 0;\n        _t = 0;\n        Array.Clear(_shown);\n        if (player != null)\n            Say(player, \"Счёт убийств сброшен.\");\n    }\n\n    private void OnMapStart(string map)\n    {\n        _ct = 0;\n        _t = 0;\n        Array.Clear(_shown);\n        for (var slot = 0; slot < _plates.Length; slot++)\n            _plates[slot] = null;\n    }\n\n    private void OnDisconnect(int slot)\n    {\n        if ((uint)slot >= 64)\n            return;\n        Destroy(slot);\n        _hidden[slot] = false;\n    }\n\n    private void OnTick()\n    {\n        var line = Format();\n        foreach (var player in Utilities.GetPlayers())\n        {\n            if (!AliveHuman(player))\n                continue;\n            var slot = player.Slot;\n            if ((uint)slot >= 64 || _hidden[slot])\n                continue;\n\n            var text = _plates[slot];\n            if (text == null || !text.IsValid)\n                continue;\n\n            Place(player, text);\n            if (_shown[slot] == line)\n                continue;\n            text.AcceptInput(\"SetMessage\", null, null, line);\n            _shown[slot] = line;\n        }\n    }\n\n    private void OnTransmit(CCheckTransmitInfoList list)\n    {\n        foreach (var (info, player) in list)\n        {\n            if (player == null || !player.IsValid)\n                continue;\n            var self = player.Slot;\n            if ((uint)self >= 64)\n                continue;\n            for (var slot = 0; slot < _plates.Length; slot++)\n            {\n                var text = _plates[slot];\n                if (text == null || !text.IsValid)\n                    continue;\n                if (slot != self || _hidden[self])\n                    info.TransmitEntities.Remove(text);\n            }\n        }\n    }\n\n    private void EnsureEveryone()\n    {\n        foreach (var player in Utilities.GetPlayers())\n        {\n            if (AliveHuman(player))\n                Ensure(player);\n        }\n    }\n\n    private void Ensure(CCSPlayerController player)\n    {\n        var slot = player.Slot;\n        if ((uint)slot >= 64 || _hidden[slot])\n            return;\n        if (_plates[slot] is { IsValid: true })\n            return;\n\n        var text = Utilities.CreateEntityByName<CPointWorldText>(\"point_worldtext\");\n        if (text == null || !text.IsValid)\n            return;\n\n        text.Enabled = true;\n        text.Fullbright = true;\n        text.FontName = Config.FontName;\n        text.FontSize = Config.FontSize;\n        text.WorldUnitsPerPx = Config.UnitsPerPixel;\n        text.Color = new Color(Config.Red, Config.Green, Config.Blue, 255);\n        text.JustifyHorizontal = PointWorldTextJustifyHorizontal_t.POINT_WORLD_TEXT_JUSTIFY_HORIZONTAL_CENTER;\n        text.JustifyVertical = PointWorldTextJustifyVertical_t.POINT_WORLD_TEXT_JUSTIFY_VERTICAL_CENTER;\n        text.ReorientMode = PointWorldTextReorientMode_t.POINT_WORLD_TEXT_REORIENT_NONE;\n        text.DrawBackground = Config.Background;\n        text.BackgroundBorderWidth = 0.1f;\n        text.BackgroundBorderHeight = 0.045f;\n        text.DepthOffset = 0f;\n        text.MessageText = Format();\n        text.DispatchSpawn();\n\n        _plates[slot] = text;\n        _shown[slot] = \"\";\n        Place(player, text);\n    }\n\n    private void Place(CCSPlayerController player, CPointWorldText text)\n    {\n        var pawn = player.PlayerPawn.Value;\n        if (pawn == null || !pawn.IsValid || pawn.AbsOrigin is not Vector origin)\n            return;\n        var eye = pawn.V_angle;\n        AngleVectors(eye, out var forward, out var right, out var up);\n\n        var pos = new Vector(\n            origin.X + forward.X * Config.Forward + right.X * Config.Right + up.X * Config.Up,\n            origin.Y + forward.Y * Config.Forward + right.Y * Config.Right + up.Y * Config.Up,\n            origin.Z + pawn.ViewOffset.Z + forward.Z * Config.Forward + right.Z * Config.Right + up.Z * Config.Up);\n\n        var face = new QAngle(0f, eye.Y + 270f, 90f - eye.X);\n        text.Teleport(pos, face, null);\n    }\n\n    private void Destroy(int slot)\n    {\n        var text = _plates[slot];\n        _plates[slot] = null;\n        _shown[slot] = \"\";\n        if (text == null || !text.IsValid)\n            return;\n        text.AcceptInput(\"Kill\");\n    }\n\n    private string Format()\n    {\n        var width = Math.Max(2, Math.Max(Digits(_ct), Digits(_t)));\n        return $\"CT  {_ct.ToString().PadLeft(width)}    {_t.ToString().PadLeft(width)}  T\";\n    }\n\n    private static int Digits(int value) => Math.Max(1, value.ToString().Length);\n\n    private static bool AliveHuman(CCSPlayerController? player) =>\n        player is { IsValid: true, IsBot: false, IsHLTV: false, PawnIsAlive: true };\n\n    private static void Say(CCSPlayerController player, string message)\n    {\n        player.PrintToChat($\" {ChatColors.Blue}[Мороз] {ChatColors.Default}{message}\");\n    }\n\n    private static void AngleVectors(QAngle angles, out Vector forward, out Vector right, out Vector up)\n    {\n        var pitch = angles.X * (MathF.PI / 180f);\n        var yaw = angles.Y * (MathF.PI / 180f);\n        var sp = MathF.Sin(pitch);\n        var cp = MathF.Cos(pitch);\n        var sy = MathF.Sin(yaw);\n        var cy = MathF.Cos(yaw);\n\n        forward = new Vector(cp * cy, cp * sy, -sp);\n        right = new Vector(-sy, cy, 0f);\n        up = new Vector(sp * cy, sp * sy, cp);\n    }\n}\n";
var Moroz_default$1 = "<Project Sdk=\"Microsoft.NET.Sdk\">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <ImplicitUsings>enable</ImplicitUsings>\n    <Nullable>enable</Nullable>\n    <AssemblyName>Moroz</AssemblyName>\n    <RootNamespace>Moroz</RootNamespace>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include=\"CounterStrikeSharp.API\" Version=\"1.0.376\" />\n  </ItemGroup>\n</Project>\n";
var README_default = "# Мороз\n\nОтдельный плагин для зимнего сервера CS2. Считает убийства спецназа и террористов и держит одну компактную плашку сверху экрана: `CT  04    02  T`.\n\nТекст ледяной, со своей подложкой, и виден только тому игроку, над чьим взглядом он висит. Чужие плашки не передаются.\n\n## Команды\n\nИгроки пишут в чат `!moroz` и `!morozreset` — CounterStrikeSharp сам вызывает `css_moroz` и `css_morozreset`.\n\n| Команда | Кто | Что делает |\n| --- | --- | --- |\n| `!moroz` | любой | спрятать или вернуть плашку |\n| `!morozreset` | админ `@css/generic` или консоль сервера | обнулить оба счёта |\n\nСвои убийства союзников не считаются. Это меняется в конфиге: `\"CountTeamKills\": true`. По умолчанию счёт живёт всю карту. `\"ResetEachRound\": true` обнуляет его в начале раунда.\n\n## Установка\n\nНа сервере уже должны стоять Metamod и CounterStrikeSharp. На компьютере, где собираете плагин, нужен .NET 8 SDK.\n\n```bash\ndotnet build -c Release\n```\n\nИз `bin/Release/net8.0` скопируйте в `game/csgo/addons/counterstrikesharp/plugins/Moroz/` только три файла:\n\n- `Moroz.dll`\n- `Moroz.deps.json`\n- `Moroz.pdb`\n\n`CounterStrikeSharp.API.dll` рядом класть не нужно — он уже есть у самого CounterStrikeSharp, а копия в папке плагина ломает загрузку.\n\nПерезапустите карту. Конфиг появится сам:\n\n`game/csgo/addons/counterstrikesharp/configs/plugins/Moroz/Moroz.json`\n\nГотовый пример лежит в `example-config/Moroz.json`. Его можно положить по пути выше до первого запуска.\n\n## Если плашка не там\n\nМеняйте только конфиг, пересобирать не нужно. После правки: `css_plugins reload Moroz`.\n\n| Поле | Смысл |\n| --- | --- |\n| `Up` | выше или ниже. Больше — ближе к верхнему краю |\n| `Forward` | дальше от камеры. Если режет прицел, увеличьте |\n| `Right` | сдвиг вбок. 0 — по центру |\n| `FontSize` | размер букв |\n| `UnitsPerPixel` | масштаб. Меньше — крупнее надпись |\n| `FontName` | шрифт, который есть на сервере. Обычно `Arial` |\n| `Red` `Green` `Blue` | цвет льда, 0–255 |\n| `Background` | тёмная подложка под текст |\n\nЗимний вид по умолчанию: светлый лёд `214 232 242`, тёмная плашка, полный яркий шрифт, чтобы на снежной карте цифры не терялись.\n";
var Moroz_default = "{\n  \"ConfigVersion\": 1,\n  \"Forward\": 8,\n  \"Up\": 2.7,\n  \"Right\": 0,\n  \"FontSize\": 32,\n  \"UnitsPerPixel\": 0.01,\n  \"FontName\": \"Arial\",\n  \"ResetEachRound\": false,\n  \"CountTeamKills\": false,\n  \"Background\": true,\n  \"Red\": 214,\n  \"Green\": 232,\n  \"Blue\": 242\n}\n";
var CRC = (() => {
	const table = /* @__PURE__ */ new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();
function crc32(data) {
	let c = 4294967295;
	for (let i = 0; i < data.length; i += 1) c = CRC[(c ^ data[i]) & 255] ^ c >>> 8;
	return (c ^ 4294967295) >>> 0;
}
function u16(value) {
	const bytes = /* @__PURE__ */ new Uint8Array(2);
	new DataView(bytes.buffer).setUint16(0, value, true);
	return bytes;
}
function u32(value) {
	const bytes = /* @__PURE__ */ new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, value, true);
	return bytes;
}
function concat(parts) {
	const size = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(size);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}
function zipStore(files) {
	const encoder = new TextEncoder();
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const file of files) {
		const name = encoder.encode(file.name);
		const data = encoder.encode(file.text);
		const crc = crc32(data);
		const local = concat([
			u32(67324752),
			u16(20),
			u16(2048),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			name,
			data
		]);
		locals.push(local);
		centrals.push(concat([
			u32(33639248),
			u16(20),
			u16(20),
			u16(2048),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name
		]));
		offset += local.length;
	}
	const central = concat(centrals);
	const end = concat([
		u32(101010256),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(central.length),
		u32(offset),
		u16(0)
	]);
	const body = part(concat(locals));
	const directory = part(central);
	const tail = part(end);
	return new Blob([
		body,
		directory,
		tail
	], { type: "application/zip" });
}
function part(bytes) {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}
var FLAKES = [
	{
		left: 6,
		delay: 0,
		duration: 16,
		size: 2,
		fade: .35
	},
	{
		left: 14,
		delay: 3,
		duration: 19,
		size: 3,
		fade: .22
	},
	{
		left: 23,
		delay: 1,
		duration: 13,
		size: 2,
		fade: .4
	},
	{
		left: 31,
		delay: 6,
		duration: 18,
		size: 2,
		fade: .28
	},
	{
		left: 42,
		delay: 2,
		duration: 15,
		size: 3,
		fade: .2
	},
	{
		left: 53,
		delay: 4,
		duration: 21,
		size: 2,
		fade: .33
	},
	{
		left: 61,
		delay: 1.5,
		duration: 14,
		size: 2,
		fade: .25
	},
	{
		left: 70,
		delay: 7,
		duration: 17,
		size: 3,
		fade: .18
	},
	{
		left: 78,
		delay: 2.5,
		duration: 12,
		size: 2,
		fade: .38
	},
	{
		left: 86,
		delay: 5,
		duration: 20,
		size: 2,
		fade: .24
	},
	{
		left: 93,
		delay: .8,
		duration: 15,
		size: 3,
		fade: .16
	},
	{
		left: 48,
		delay: 8,
		duration: 18,
		size: 2,
		fade: .3
	}
];
function Digits({ value }) {
	const text = String(value).padStart(2, "0");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "inline-flex tabular-nums text-2xl font-semibold tracking-tight text-fg",
		children: text.split("").map((digit, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "digit",
			children: digit
		}, `${index}-${digit}`))
	});
}
function MorozStage() {
	const [ct, setCt] = (0, import_react.useState)(0);
	const [terror, setTerror] = (0, import_react.useState)(0);
	const [flash, setFlash] = (0, import_react.useState)(null);
	const [open, setOpen] = (0, import_react.useState)(false);
	function score(team) {
		if (team === "ct") setCt((value) => value + 1);
		else setTerror((value) => value + 1);
		setFlash(team);
	}
	function download() {
		const blob = zipStore([
			{
				name: "Moroz/Moroz.csproj",
				text: Moroz_default$1
			},
			{
				name: "Moroz/MorozPlugin.cs",
				text: MorozPlugin_default
			},
			{
				name: "Moroz/README.md",
				text: README_default
			},
			{
				name: "Moroz/example-config/Moroz.json",
				text: Moroz_default
			}
		]);
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "Moroz.zip";
		link.click();
		URL.revokeObjectURL(url);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between gap-4 px-4 py-4 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-widest text-muted uppercase",
					children: "CS2"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-sans text-xl font-semibold tracking-tight",
					children: "Мороз"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: download,
					className: "min-h-11 rounded-md bg-ice px-4 text-sm font-semibold text-ice-ink transition-opacity duration-150 hover:opacity-90",
					children: "Скачать плагин"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "winter-view mx-4 mb-4 flex flex-1 sm:mx-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/winter-field.jpg",
						alt: ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "winter-shade",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pointer-events-none absolute inset-0",
						"aria-hidden": "true",
						children: FLAKES.map((flake) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flake absolute top-0 rounded-full bg-fg",
							style: {
								left: `${flake.left}%`,
								width: flake.size,
								height: flake.size,
								opacity: flake.fade,
								animationDuration: `${flake.duration}s`,
								animationDelay: `${flake.delay}s`
							}
						}, flake.left))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2",
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-1/2 left-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-1/2 right-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-x-4 top-5 mx-auto max-w-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "plaque",
							"aria-live": "polite",
							"aria-label": `CT ${ct}, T ${terror}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold tracking-widest text-ice",
									children: "CT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Digits, { value: ct }), flash === "ct" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice",
										children: "+1"
									}, ct) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "plaque-mark",
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Digits, { value: terror }), flash === "t" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice",
										children: "+1"
									}, terror) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold tracking-widest text-ice",
									children: "T"
								})
							]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "flex flex-col gap-4 px-4 pb-6 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-xl text-sm leading-relaxed text-pretty text-muted",
						children: "Отдельный плагин для зимнего сервера. Считает убийства CT и T и держит такую плашку сверху экрана — компактно, без чата."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => score("ct"),
								className: "min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg",
								children: "Фраг CT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => score("t"),
								className: "min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg",
								children: "Фраг T"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setCt(0);
									setTerror(0);
									setFlash(null);
								},
								className: "min-h-11 rounded-sm px-4 text-sm font-medium text-muted",
								children: "Сброс"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setOpen((value) => !value),
						className: "self-start text-sm font-medium text-ice",
						"aria-expanded": open,
						children: open ? "Скрыть установку" : "Как поставить на сервер"
					}),
					open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "max-w-xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-pretty text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "На сервере уже стоят Metamod и CounterStrikeSharp, на компьютере — .NET 8." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Распакуйте архив и в папке Moroz выполните сборку Release." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "В plugins/Moroz положите только Moroz.dll, Moroz.deps.json и Moroz.pdb. Файл API туда не копируйте." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Высоту плашки потом крутите полем Up в конфиге. Игроки прячут её командой !moroz." })
						]
					}) : null
				]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MorozStage, {});
}
//#endregion
export { Home as component };
