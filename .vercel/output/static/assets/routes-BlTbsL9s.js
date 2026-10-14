import{n as e,r as t,t as n}from"./index-DOdi_qFB.js";var r=t(e(),1),i=`using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Attributes;
using CounterStrikeSharp.API.Core.Attributes.Registration;
using CounterStrikeSharp.API.Modules.Admin;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Utils;

namespace Moroz;

public sealed class MorozConfig : BasePluginConfig
{
    public float Forward { get; set; } = 8f;
    public float Up { get; set; } = 2.7f;
    public float Right { get; set; } = 0f;
    public float FontSize { get; set; } = 32f;
    public float UnitsPerPixel { get; set; } = 0.01f;
    public string FontName { get; set; } = "Arial";
    public bool ResetEachRound { get; set; }
    public bool CountTeamKills { get; set; }
    public bool Background { get; set; } = true;
    public int Red { get; set; } = 214;
    public int Green { get; set; } = 232;
    public int Blue { get; set; } = 242;
}

[MinimumApiVersion(80)]
public sealed class MorozPlugin : BasePlugin, IPluginConfig<MorozConfig>
{
    public override string ModuleName => "Мороз";
    public override string ModuleVersion => "1.0.0";
    public override string ModuleAuthor => "Мороз";
    public override string ModuleDescription => "Компактный зимний счётчик убийств CT и T сверху экрана.";

    public MorozConfig Config { get; set; } = new();

    private readonly CPointWorldText?[] _plates = new CPointWorldText?[64];
    private readonly string[] _shown = new string[64];
    private readonly bool[] _hidden = new bool[64];
    private int _ct;
    private int _t;

    public void OnConfigParsed(MorozConfig config)
    {
        config.Forward = Math.Clamp(config.Forward, 4f, 24f);
        config.Up = Math.Clamp(config.Up, 0.4f, 8f);
        config.Right = Math.Clamp(config.Right, -6f, 6f);
        config.FontSize = Math.Clamp(config.FontSize, 12f, 96f);
        config.UnitsPerPixel = Math.Clamp(config.UnitsPerPixel, 0.004f, 0.05f);
        config.Red = Math.Clamp(config.Red, 0, 255);
        config.Green = Math.Clamp(config.Green, 0, 255);
        config.Blue = Math.Clamp(config.Blue, 0, 255);
        if (string.IsNullOrWhiteSpace(config.FontName))
            config.FontName = "Arial";
        Config = config;
    }

    public override void Load(bool hotReload)
    {
        RegisterListener<Listeners.OnTick>(OnTick);
        RegisterListener<Listeners.CheckTransmit>(OnTransmit);
        RegisterListener<Listeners.OnMapStart>(OnMapStart);
        RegisterListener<Listeners.OnClientDisconnect>(OnDisconnect);

        if (hotReload)
            AddTimer(0.5f, EnsureEveryone);
    }

    public override void Unload(bool hotReload)
    {
        for (var slot = 0; slot < _plates.Length; slot++)
            Destroy(slot);
    }

    [GameEventHandler]
    public HookResult OnSpawn(EventPlayerSpawn @event, GameEventInfo info)
    {
        var player = @event.Userid;
        if (!AliveHuman(player))
            return HookResult.Continue;

        AddTimer(0.35f, () =>
        {
            if (player is { IsValid: true })
                Ensure(player);
        });
        return HookResult.Continue;
    }

    [GameEventHandler]
    public HookResult OnDeath(EventPlayerDeath @event, GameEventInfo info)
    {
        var attacker = @event.Attacker;
        var victim = @event.Userid;
        if (attacker == null || !attacker.IsValid || attacker.IsHLTV || attacker == victim)
            return HookResult.Continue;
        if (attacker.Team is not (CsTeam.Terrorist or CsTeam.CounterTerrorist))
            return HookResult.Continue;
        if (!Config.CountTeamKills && victim != null && victim.IsValid && victim.Team == attacker.Team)
            return HookResult.Continue;

        if (attacker.Team == CsTeam.CounterTerrorist)
            _ct++;
        else
            _t++;

        return HookResult.Continue;
    }

    [GameEventHandler]
    public HookResult OnRoundStart(EventRoundStart @event, GameEventInfo info)
    {
        if (Config.ResetEachRound)
        {
            _ct = 0;
            _t = 0;
            Array.Clear(_shown);
        }

        AddTimer(0.5f, EnsureEveryone);
        return HookResult.Continue;
    }

    [ConsoleCommand("css_moroz", "Скрыть или показать зимний счётчик")]
    public void OnToggle(CCSPlayerController? player, CommandInfo command)
    {
        if (player == null || !player.IsValid)
            return;
        var slot = player.Slot;
        if ((uint)slot >= 64)
            return;

        _hidden[slot] = !_hidden[slot];
        if (_hidden[slot])
        {
            Destroy(slot);
            Say(player, "Счётчик скрыт. Ещё раз !moroz — вернуть.");
            return;
        }

        Ensure(player);
        Say(player, "Счётчик снова сверху.");
    }

    [ConsoleCommand("css_morozreset", "Обнулить счёт убийств CT и T")]
    public void OnReset(CCSPlayerController? player, CommandInfo command)
    {
        if (player != null && !AdminManager.PlayerHasPermissions(player, "@css/generic"))
        {
            Say(player, "Обнулить может только админ.");
            return;
        }

        _ct = 0;
        _t = 0;
        Array.Clear(_shown);
        if (player != null)
            Say(player, "Счёт убийств сброшен.");
    }

    private void OnMapStart(string map)
    {
        _ct = 0;
        _t = 0;
        Array.Clear(_shown);
        for (var slot = 0; slot < _plates.Length; slot++)
            _plates[slot] = null;
    }

    private void OnDisconnect(int slot)
    {
        if ((uint)slot >= 64)
            return;
        Destroy(slot);
        _hidden[slot] = false;
    }

    private void OnTick()
    {
        var line = Format();
        foreach (var player in Utilities.GetPlayers())
        {
            if (!AliveHuman(player))
                continue;
            var slot = player.Slot;
            if ((uint)slot >= 64 || _hidden[slot])
                continue;

            var text = _plates[slot];
            if (text == null || !text.IsValid)
                continue;

            Place(player, text);
            if (_shown[slot] == line)
                continue;
            text.AcceptInput("SetMessage", null, null, line);
            _shown[slot] = line;
        }
    }

    private void OnTransmit(CCheckTransmitInfoList list)
    {
        foreach (var (info, player) in list)
        {
            if (player == null || !player.IsValid)
                continue;
            var self = player.Slot;
            if ((uint)self >= 64)
                continue;
            for (var slot = 0; slot < _plates.Length; slot++)
            {
                var text = _plates[slot];
                if (text == null || !text.IsValid)
                    continue;
                if (slot != self || _hidden[self])
                    info.TransmitEntities.Remove(text);
            }
        }
    }

    private void EnsureEveryone()
    {
        foreach (var player in Utilities.GetPlayers())
        {
            if (AliveHuman(player))
                Ensure(player);
        }
    }

    private void Ensure(CCSPlayerController player)
    {
        var slot = player.Slot;
        if ((uint)slot >= 64 || _hidden[slot])
            return;
        if (_plates[slot] is { IsValid: true })
            return;

        var text = Utilities.CreateEntityByName<CPointWorldText>("point_worldtext");
        if (text == null || !text.IsValid)
            return;

        text.Enabled = true;
        text.Fullbright = true;
        text.FontName = Config.FontName;
        text.FontSize = Config.FontSize;
        text.WorldUnitsPerPx = Config.UnitsPerPixel;
        text.Color = new Color(Config.Red, Config.Green, Config.Blue, 255);
        text.JustifyHorizontal = PointWorldTextJustifyHorizontal_t.POINT_WORLD_TEXT_JUSTIFY_HORIZONTAL_CENTER;
        text.JustifyVertical = PointWorldTextJustifyVertical_t.POINT_WORLD_TEXT_JUSTIFY_VERTICAL_CENTER;
        text.ReorientMode = PointWorldTextReorientMode_t.POINT_WORLD_TEXT_REORIENT_NONE;
        text.DrawBackground = Config.Background;
        text.BackgroundBorderWidth = 0.1f;
        text.BackgroundBorderHeight = 0.045f;
        text.DepthOffset = 0f;
        text.MessageText = Format();
        text.DispatchSpawn();

        _plates[slot] = text;
        _shown[slot] = "";
        Place(player, text);
    }

    private void Place(CCSPlayerController player, CPointWorldText text)
    {
        var pawn = player.PlayerPawn.Value;
        if (pawn == null || !pawn.IsValid || pawn.AbsOrigin is not Vector origin)
            return;
        var eye = pawn.V_angle;
        AngleVectors(eye, out var forward, out var right, out var up);

        var pos = new Vector(
            origin.X + forward.X * Config.Forward + right.X * Config.Right + up.X * Config.Up,
            origin.Y + forward.Y * Config.Forward + right.Y * Config.Right + up.Y * Config.Up,
            origin.Z + pawn.ViewOffset.Z + forward.Z * Config.Forward + right.Z * Config.Right + up.Z * Config.Up);

        var face = new QAngle(0f, eye.Y + 270f, 90f - eye.X);
        text.Teleport(pos, face, null);
    }

    private void Destroy(int slot)
    {
        var text = _plates[slot];
        _plates[slot] = null;
        _shown[slot] = "";
        if (text == null || !text.IsValid)
            return;
        text.AcceptInput("Kill");
    }

    private string Format()
    {
        var width = Math.Max(2, Math.Max(Digits(_ct), Digits(_t)));
        return $"CT  {_ct.ToString().PadLeft(width)}    {_t.ToString().PadLeft(width)}  T";
    }

    private static int Digits(int value) => Math.Max(1, value.ToString().Length);

    private static bool AliveHuman(CCSPlayerController? player) =>
        player is { IsValid: true, IsBot: false, IsHLTV: false, PawnIsAlive: true };

    private static void Say(CCSPlayerController player, string message)
    {
        player.PrintToChat($" {ChatColors.Blue}[Мороз] {ChatColors.Default}{message}");
    }

    private static void AngleVectors(QAngle angles, out Vector forward, out Vector right, out Vector up)
    {
        var pitch = angles.X * (MathF.PI / 180f);
        var yaw = angles.Y * (MathF.PI / 180f);
        var sp = MathF.Sin(pitch);
        var cp = MathF.Cos(pitch);
        var sy = MathF.Sin(yaw);
        var cy = MathF.Cos(yaw);

        forward = new Vector(cp * cy, cp * sy, -sp);
        right = new Vector(-sy, cy, 0f);
        up = new Vector(sp * cy, sp * sy, cp);
    }
}
`,a=`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Moroz</AssemblyName>
    <RootNamespace>Moroz</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CounterStrikeSharp.API" Version="1.0.376" />
  </ItemGroup>
</Project>
`,o='# Мороз\n\nОтдельный плагин для зимнего сервера CS2. Считает убийства спецназа и террористов и держит одну компактную плашку сверху экрана: `CT  04    02  T`.\n\nТекст ледяной, со своей подложкой, и виден только тому игроку, над чьим взглядом он висит. Чужие плашки не передаются.\n\n## Команды\n\nИгроки пишут в чат `!moroz` и `!morozreset` — CounterStrikeSharp сам вызывает `css_moroz` и `css_morozreset`.\n\n| Команда | Кто | Что делает |\n| --- | --- | --- |\n| `!moroz` | любой | спрятать или вернуть плашку |\n| `!morozreset` | админ `@css/generic` или консоль сервера | обнулить оба счёта |\n\nСвои убийства союзников не считаются. Это меняется в конфиге: `"CountTeamKills": true`. По умолчанию счёт живёт всю карту. `"ResetEachRound": true` обнуляет его в начале раунда.\n\n## Установка\n\nНа сервере уже должны стоять Metamod и CounterStrikeSharp. На компьютере, где собираете плагин, нужен .NET 8 SDK.\n\n```bash\ndotnet build -c Release\n```\n\nИз `bin/Release/net8.0` скопируйте в `game/csgo/addons/counterstrikesharp/plugins/Moroz/` только три файла:\n\n- `Moroz.dll`\n- `Moroz.deps.json`\n- `Moroz.pdb`\n\n`CounterStrikeSharp.API.dll` рядом класть не нужно — он уже есть у самого CounterStrikeSharp, а копия в папке плагина ломает загрузку.\n\nПерезапустите карту. Конфиг появится сам:\n\n`game/csgo/addons/counterstrikesharp/configs/plugins/Moroz/Moroz.json`\n\nГотовый пример лежит в `example-config/Moroz.json`. Его можно положить по пути выше до первого запуска.\n\n## Если плашка не там\n\nМеняйте только конфиг, пересобирать не нужно. После правки: `css_plugins reload Moroz`.\n\n| Поле | Смысл |\n| --- | --- |\n| `Up` | выше или ниже. Больше — ближе к верхнему краю |\n| `Forward` | дальше от камеры. Если режет прицел, увеличьте |\n| `Right` | сдвиг вбок. 0 — по центру |\n| `FontSize` | размер букв |\n| `UnitsPerPixel` | масштаб. Меньше — крупнее надпись |\n| `FontName` | шрифт, который есть на сервере. Обычно `Arial` |\n| `Red` `Green` `Blue` | цвет льда, 0–255 |\n| `Background` | тёмная подложка под текст |\n\nЗимний вид по умолчанию: светлый лёд `214 232 242`, тёмная плашка, полный яркий шрифт, чтобы на снежной карте цифры не терялись.\n',s=`{
  "ConfigVersion": 1,
  "Forward": 8,
  "Up": 2.7,
  "Right": 0,
  "FontSize": 32,
  "UnitsPerPixel": 0.01,
  "FontName": "Arial",
  "ResetEachRound": false,
  "CountTeamKills": false,
  "Background": true,
  "Red": 214,
  "Green": 232,
  "Blue": 242
}
`,c=(()=>{let e=new Uint32Array(256);for(let t=0;t<256;t+=1){let n=t;for(let e=0;e<8;e+=1)n=n&1?3988292384^n>>>1:n>>>1;e[t]=n>>>0}return e})();function l(e){let t=4294967295;for(let n=0;n<e.length;n+=1)t=c[(t^e[n])&255]^t>>>8;return(t^4294967295)>>>0}function u(e){let t=new Uint8Array(2);return new DataView(t.buffer).setUint16(0,e,!0),t}function d(e){let t=new Uint8Array(4);return new DataView(t.buffer).setUint32(0,e,!0),t}function f(e){let t=e.reduce((e,t)=>e+t.length,0),n=new Uint8Array(t),r=0;for(let t of e)n.set(t,r),r+=t.length;return n}function p(e){let t=new TextEncoder,n=[],r=[],i=0;for(let a of e){let e=t.encode(a.name),o=t.encode(a.text),s=l(o),c=f([d(67324752),u(20),u(2048),u(0),u(0),u(0),d(s),d(o.length),d(o.length),u(e.length),u(0),e,o]);n.push(c),r.push(f([d(33639248),u(20),u(20),u(2048),u(0),u(0),u(0),d(s),d(o.length),d(o.length),u(e.length),u(0),u(0),u(0),u(0),d(0),d(i),e])),i+=c.length}let a=f(r),o=f([d(101010256),u(0),u(0),u(e.length),u(e.length),d(a.length),d(i),u(0)]),s=m(f(n)),c=m(a),p=m(o);return new Blob([s,c,p],{type:`application/zip`})}function m(e){let t=new ArrayBuffer(e.byteLength);return new Uint8Array(t).set(e),t}var h=n(),g=[{left:6,delay:0,duration:16,size:2,fade:.35},{left:14,delay:3,duration:19,size:3,fade:.22},{left:23,delay:1,duration:13,size:2,fade:.4},{left:31,delay:6,duration:18,size:2,fade:.28},{left:42,delay:2,duration:15,size:3,fade:.2},{left:53,delay:4,duration:21,size:2,fade:.33},{left:61,delay:1.5,duration:14,size:2,fade:.25},{left:70,delay:7,duration:17,size:3,fade:.18},{left:78,delay:2.5,duration:12,size:2,fade:.38},{left:86,delay:5,duration:20,size:2,fade:.24},{left:93,delay:.8,duration:15,size:3,fade:.16},{left:48,delay:8,duration:18,size:2,fade:.3}];function _({value:e}){let t=String(e).padStart(2,`0`);return(0,h.jsx)(`span`,{className:`inline-flex tabular-nums text-2xl font-semibold tracking-tight text-fg`,children:t.split(``).map((e,t)=>(0,h.jsx)(`span`,{className:`digit`,children:e},`${t}-${e}`))})}function v(){let[e,t]=(0,r.useState)(0),[n,c]=(0,r.useState)(0),[l,u]=(0,r.useState)(null),[d,f]=(0,r.useState)(!1);function m(e){e===`ct`?t(e=>e+1):c(e=>e+1),u(e)}function v(){let e=p([{name:`Moroz/Moroz.csproj`,text:a},{name:`Moroz/MorozPlugin.cs`,text:i},{name:`Moroz/README.md`,text:o},{name:`Moroz/example-config/Moroz.json`,text:s}]),t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`Moroz.zip`,n.click(),URL.revokeObjectURL(t)}return(0,h.jsxs)(`div`,{className:`flex min-h-dvh flex-col bg-bg text-fg`,children:[(0,h.jsxs)(`header`,{className:`flex items-center justify-between gap-4 px-4 py-4 sm:px-6`,children:[(0,h.jsxs)(`div`,{children:[(0,h.jsx)(`p`,{className:`text-xs font-medium tracking-widest text-muted uppercase`,children:`CS2`}),(0,h.jsx)(`h1`,{className:`font-sans text-xl font-semibold tracking-tight`,children:`Мороз`})]}),(0,h.jsx)(`button`,{type:`button`,onClick:v,className:`min-h-11 rounded-md bg-ice px-4 text-sm font-semibold text-ice-ink transition-opacity duration-150 hover:opacity-90`,children:`Скачать плагин`})]}),(0,h.jsxs)(`div`,{className:`winter-view mx-4 mb-4 flex flex-1 sm:mx-6`,children:[(0,h.jsx)(`img`,{src:`/winter-field.jpg`,alt:``}),(0,h.jsx)(`div`,{className:`winter-shade`,"aria-hidden":`true`}),(0,h.jsx)(`div`,{className:`pointer-events-none absolute inset-0`,"aria-hidden":`true`,children:g.map(e=>(0,h.jsx)(`span`,{className:`flake absolute top-0 rounded-full bg-fg`,style:{left:`${e.left}%`,width:e.size,height:e.size,opacity:e.fade,animationDuration:`${e.duration}s`,animationDelay:`${e.delay}s`}},e.left))}),(0,h.jsxs)(`div`,{className:`pointer-events-none absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2`,"aria-hidden":`true`,children:[(0,h.jsx)(`span`,{className:`absolute top-1/2 left-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70`}),(0,h.jsx)(`span`,{className:`absolute top-1/2 right-0 h-px w-1.5 -translate-y-1/2 bg-fg opacity-70`}),(0,h.jsx)(`span`,{className:`absolute top-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70`}),(0,h.jsx)(`span`,{className:`absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg opacity-70`})]}),(0,h.jsx)(`div`,{className:`absolute inset-x-4 top-5 mx-auto max-w-sm`,children:(0,h.jsxs)(`div`,{className:`plaque`,"aria-live":`polite`,"aria-label":`CT ${e}, T ${n}`,children:[(0,h.jsx)(`span`,{className:`text-xs font-semibold tracking-widest text-ice`,children:`CT`}),(0,h.jsxs)(`span`,{className:`relative`,children:[(0,h.jsx)(_,{value:e}),l===`ct`?(0,h.jsx)(`span`,{className:`plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice`,children:`+1`},e):null]}),(0,h.jsx)(`span`,{className:`plaque-mark`,"aria-hidden":`true`}),(0,h.jsxs)(`span`,{className:`relative`,children:[(0,h.jsx)(_,{value:n}),l===`t`?(0,h.jsx)(`span`,{className:`plus absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium text-ice`,children:`+1`},n):null]}),(0,h.jsx)(`span`,{className:`text-xs font-semibold tracking-widest text-ice`,children:`T`})]})})]}),(0,h.jsxs)(`footer`,{className:`flex flex-col gap-4 px-4 pb-6 sm:px-6`,children:[(0,h.jsx)(`p`,{className:`max-w-xl text-sm leading-relaxed text-pretty text-muted`,children:`Отдельный плагин для зимнего сервера. Считает убийства CT и T и держит такую плашку сверху экрана — компактно, без чата.`}),(0,h.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,h.jsx)(`button`,{type:`button`,onClick:()=>m(`ct`),className:`min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg`,children:`Фраг CT`}),(0,h.jsx)(`button`,{type:`button`,onClick:()=>m(`t`),className:`min-h-11 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-fg`,children:`Фраг T`}),(0,h.jsx)(`button`,{type:`button`,onClick:()=>{t(0),c(0),u(null)},className:`min-h-11 rounded-sm px-4 text-sm font-medium text-muted`,children:`Сброс`})]}),(0,h.jsx)(`button`,{type:`button`,onClick:()=>f(e=>!e),className:`self-start text-sm font-medium text-ice`,"aria-expanded":d,children:d?`Скрыть установку`:`Как поставить на сервер`}),d?(0,h.jsxs)(`ol`,{className:`max-w-xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-pretty text-muted`,children:[(0,h.jsx)(`li`,{children:`На сервере уже стоят Metamod и CounterStrikeSharp, на компьютере — .NET 8.`}),(0,h.jsx)(`li`,{children:`Распакуйте архив и в папке Moroz выполните сборку Release.`}),(0,h.jsx)(`li`,{children:`В plugins/Moroz положите только Moroz.dll, Moroz.deps.json и Moroz.pdb. Файл API туда не копируйте.`}),(0,h.jsx)(`li`,{children:`Высоту плашки потом крутите полем Up в конфиге. Игроки прячут её командой !moroz.`})]}):null]})]})}function y(){return(0,h.jsx)(v,{})}export{y as component};