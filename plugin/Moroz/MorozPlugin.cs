using CounterStrikeSharp.API;
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
