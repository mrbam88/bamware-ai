// Screensaver host: watches for idle and covers the chosen displays with the
// wall board. Runs as its own Quickshell instance beside the Omarchy shell, so
// an Omarchy update never overwrites it.
import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

ShellRoot {
    id: root

    readonly property string here: Quickshell.shellDir + "/"
    readonly property int idleSeconds: Math.max(10, Number(Quickshell.env("WALLBOARD_IDLE_SECONDS") || 150))
    // "all", or a comma-separated list of connector names such as "eDP-1".
    readonly property string screenFilter: Quickshell.env("WALLBOARD_SCREENS") || "all"

    property bool shown: false
    // Shown by hand (IPC) rather than by idleness, so idle state must not hide it.
    property bool forced: false
    property var info: ({})
    // True once the collector has answered for this showing, so no screen is covered on stale information.
    property bool fresh: false
    property date now: new Date()

    function wantsScreen(name) {
        // A screen showing a full-screen window while something plays is being watched: leave it alone.
        var media = root.info.media || {}
        if (media.playing && (media.screens || []).indexOf(name) !== -1) return false
        if (root.screenFilter === "all") return true
        return root.screenFilter.split(",").map(function(s) { return s.trim() }).indexOf(name) !== -1
    }

    function show(byHand) {
        root.forced = !!byHand
        root.now = new Date()
        root.fresh = false
        root.shown = true
        // Shown and hidden times go to the journal: after a freeze they say whether the board was up.
        console.log("wallboard: shown" + (root.forced ? " by hand" : " on idle"))
        refresh()
    }

    function hide() {
        if (root.shown) console.log("wallboard: hidden")
        root.shown = false
        root.forced = false
    }

    function refresh() {
        if (!collector.running) collector.running = true
    }

    IdleMonitor {
        id: idle
        timeout: root.idleSeconds
        // Video players ask the compositor to hold off idling, which would keep the board off every screen.
        // The board decides per screen instead: it covers the lid and skips the one playing video.
        respectInhibitors: false
        onIsIdleChanged: {
            if (isIdle) allowed.running = true
            else if (!root.forced) root.hide()
        }
    }

    // Omarchy's own "stay awake" and "screensaver off" switches still apply.
    Process {
        id: allowed
        command: ["bash", "-c", "[[ ! -e $HOME/.local/state/omarchy/indicators/stay-awake && ! -e $HOME/.local/state/omarchy/toggles/screensaver-off ]]"]
        onExited: function(exitCode) { if (exitCode === 0 && idle.isIdle) root.show(false) }
    }

    Process {
        id: collector
        command: ["python3", root.here + "collect.py"]
        stdout: StdioCollector {
            onStreamFinished: {
                try { root.info = JSON.parse(text) } catch (error) { console.warn("wallboard: unreadable collector output: " + error) }
                root.fresh = true
            }
        }
    }

    // Nothing ticks while the board is hidden.
    Timer { interval: 1000; repeat: true; running: root.shown; onTriggered: root.now = new Date() }
    // Often enough that the board gets out of the way soon after a video starts, or changes track with the music.
    Timer { interval: 20000; repeat: true; running: root.shown; onTriggered: root.refresh() }

    IpcHandler {
        target: "wallboard"
        // Not "show": the qs command line reads that word as its own subcommand.
        function open(): void { root.show(true) }
        function close(): void { root.hide() }
        function toggle(): void { if (root.shown) root.hide(); else root.show(true) }
        function status(): string {
            return JSON.stringify({ shown: root.shown, forced: root.forced, idle: idle.isIdle, idleSeconds: root.idleSeconds,
                screens: root.screenFilter, dataFrom: root.info.generatedAt || null,
                playing: !!(root.info.media && root.info.media.playing), skipped: (root.info.media && root.info.media.screens) || [] })
        }
    }

    Variants {
        model: Quickshell.screens

        PanelWindow {
            id: panel
            required property var modelData
            screen: modelData
            visible: root.shown && root.fresh && root.wantsScreen(modelData.name)
            color: "#0e0e14"
            anchors { top: true; bottom: true; left: true; right: true }
            exclusionMode: ExclusionMode.Ignore
            WlrLayershell.namespace: "bamware-wallboard"
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

            // Built only while showing, so a hidden board holds no scene and no timers.
            Loader {
                anchors.fill: parent
                active: panel.visible
                sourceComponent: Board {
                    info: root.info
                    now: root.now
                }
            }

            // Any key or a real mouse movement dismisses. The surface appearing
            // under a resting pointer sends a motion event of its own, hence the
            // short grace and the distance check.
            Item {
                anchors.fill: parent
                focus: true
                Keys.onPressed: function(event) { event.accepted = true; root.hide() }
            }
            MouseArea {
                id: pointer
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.BlankCursor
                acceptedButtons: Qt.AllButtons
                property real startX: -1
                property real startY: -1
                onPressed: root.hide()
                onWheel: root.hide()
                onPositionChanged: function(mouse) {
                    if (grace.running) return
                    if (startX < 0) { startX = mouse.x; startY = mouse.y; return }
                    if (Math.abs(mouse.x - startX) + Math.abs(mouse.y - startY) > 24) root.hide()
                }
                Timer { id: grace; interval: 1200 }
                Connections {
                    target: panel
                    function onVisibleChanged() { pointer.startX = -1; pointer.startY = -1; if (panel.visible) grace.restart() }
                }
            }
        }
    }
}
