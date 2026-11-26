// The wall board itself: plain Qt Quick, no shell imports, so the same file
// renders inside the screensaver overlay and in the offscreen preview.
import QtQuick

Item {
    id: board

    // The collector's JSON document, already parsed.
    property var info: ({})
    property date now: new Date()
    // The preview sets this so a still frame shows the settled layout.
    property bool instant: false

    // Every size derives from the screen height, so the lid and a 65" TV get
    // the same composition.
    readonly property real u: height / 100

    readonly property var tones: info.theme || ({})
    readonly property color ink: tones.bright_foreground || "#c0caf5"
    readonly property color soft: tones.foreground || "#a9b1d6"
    readonly property color dim: tones.dark_foreground || "#565f89"
    readonly property color accent: tones.accent || "#7aa2f7"
    readonly property color glowA: tones.bright_magenta || "#bb9af7"
    readonly property color glowB: tones.bright_cyan || "#0db9d7"
    // Bilal is red-green colourblind: trouble is amber and a different shape,
    // never red against green.
    readonly property color amber: tones.yellow || "#e0af68"
    readonly property color base: tones.darker_background || "#0e0e14"
    readonly property color rule: Qt.rgba(ink.r, ink.g, ink.b, 0.14)

    readonly property string serif: serifFont.status === FontLoader.Ready ? serifFont.name : "serif"
    readonly property string serifItalic: italicFont.status === FontLoader.Ready ? italicFont.name : serif
    readonly property string sans: sansFont.status === FontLoader.Ready ? sansFont.name : "Noto Sans"

    readonly property int minuteStamp: Math.floor(now.getTime() / 60000)

    FontLoader { id: serifFont; source: "fonts/InstrumentSerif-Regular.ttf" }
    FontLoader { id: italicFont; source: "fonts/InstrumentSerif-Italic.ttf" }
    FontLoader { id: sansFont; source: "fonts/Inter.ttf" }

    function pad(n) { return n < 10 ? "0" + n : "" + n }
    function clock(d) { var h = d.getHours() % 12; return (h === 0 ? 12 : h) + ":" + pad(d.getMinutes()) }
    function meridiem(d) { return d.getHours() < 12 ? "AM" : "PM" }
    function greeting(d) {
        var h = d.getHours()
        if (h < 5) return "Up late"
        if (h < 12) return "Good morning"
        if (h < 17) return "Good afternoon"
        if (h < 22) return "Good evening"
        return "Good night"
    }
    function dayOfYear(d) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86400000) }
    function daysInYear(d) { var y = d.getFullYear(); return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365 }
    function dayFraction(d) { return (d.getHours() * 60 + d.getMinutes()) / 1440 }
    function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
    function eventDay(start) {
        var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        if (sameDay(start, now)) return "Today"
        if (sameDay(start, tomorrow)) return "Tomorrow"
        return Qt.formatDate(start, "ddd d")
    }

    readonly property var sunrise: info.weather && info.weather.sunrise ? new Date(info.weather.sunrise) : null
    readonly property var sunset: info.weather && info.weather.sunset ? new Date(info.weather.sunset) : null
    readonly property var events: info.calendar && info.calendar.events ? info.calendar.events : []
    readonly property var systems: info.systems || []

    // The line under the hero rotates through what is waiting for a person.
    readonly property var notes: {
        var list = []
        var waiting = info.waitingOnYou || []
        for (var i = 0; i < waiting.length; i++) list.push({ tag: "Waiting on you", text: waiting[i], alert: true })
        var qa = info.board && info.board.qaTitles ? info.board.qaTitles : []
        for (var j = 0; j < qa.length; j++) list.push({ tag: "Ready for QA", text: qa[j], alert: false })
        return list
    }
    property int noteIndex: 0

    // --- backdrop ---------------------------------------------------------

    Rectangle { anchors.fill: parent; color: board.base }

    component Glow: Item {
        id: glow
        property color tint
        property real size
        width: size; height: size
        opacity: 0.0
        // Painted once at a small size and stretched: a soft blob needs no detail.
        Canvas {
            width: 256; height: 256
            scale: glow.size / 256
            transformOrigin: Item.TopLeft
            onPaint: {
                var ctx = getContext("2d")
                var g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
                g.addColorStop(0.0, Qt.rgba(glow.tint.r, glow.tint.g, glow.tint.b, 0.55))
                g.addColorStop(0.45, Qt.rgba(glow.tint.r, glow.tint.g, glow.tint.b, 0.18))
                g.addColorStop(1.0, Qt.rgba(glow.tint.r, glow.tint.g, glow.tint.b, 0.0))
                ctx.clearRect(0, 0, 256, 256)
                ctx.fillStyle = g
                ctx.fillRect(0, 0, 256, 256)
            }
            Connections { target: glow; function onTintChanged() { glow.children[0].requestPaint() } }
        }
        // The glows only travel for a few seconds when the minute turns, so an
        // always-on screen is a still picture (and an idle GPU) the rest of the time.
        Behavior on x { enabled: !board.instant; NumberAnimation { duration: 14000; easing.type: Easing.InOutSine } }
        Behavior on y { enabled: !board.instant; NumberAnimation { duration: 14000; easing.type: Easing.InOutSine } }
        Behavior on opacity { enabled: !board.instant; NumberAnimation { duration: 2400; easing.type: Easing.OutCubic } }
    }

    // Each minute picks a new resting place from a slow orbit.
    function orbit(phase, radius) { return Math.sin(minuteStamp * 0.37 + phase) * radius * u }

    Glow { tint: board.accent; size: 125 * board.u; opacity: 0.70
        x: -34 * board.u + board.orbit(0.0, 9); y: -44 * board.u + board.orbit(1.7, 7) }
    Glow { tint: board.glowA; size: 110 * board.u; opacity: 0.50
        x: board.width - 62 * board.u + board.orbit(2.4, 8); y: board.height - 58 * board.u + board.orbit(4.1, 6) }
    Glow { tint: board.glowB; size: 85 * board.u; opacity: 0.26
        x: board.width * 0.36 + board.orbit(5.2, 10); y: board.height * 0.48 + board.orbit(3.3, 7) }

    // --- content ----------------------------------------------------------

    component Caps: Text {
        font.family: board.sans
        font.pixelSize: Math.round(1.45 * board.u)
        font.weight: Font.DemiBold
        font.letterSpacing: 0.24 * board.u
        font.capitalization: Font.AllUppercase
        color: board.dim
    }

    component Rule: Rectangle { height: 1; color: board.rule }

    Item {
        id: content
        anchors.fill: parent
        opacity: board.instant ? 1 : 0
        // A few pixels of drift each minute keeps any one pixel from holding
        // the same glyph edge for days.
        transform: Translate {
            x: Math.round(Math.sin(board.minuteStamp * 0.21) * 0.8 * board.u)
            y: Math.round(Math.cos(board.minuteStamp * 0.17) * 0.6 * board.u)
        }

        readonly property real margin: 7 * board.u
        readonly property real sideWidth: Math.min(60 * board.u, width * 0.36)

        NumberAnimation on opacity { running: !board.instant; from: 0; to: 1; duration: 1600; easing.type: Easing.OutCubic }

        // Masthead.
        Caps { id: masthead; x: content.margin; y: content.margin; text: "Bamware  ·  Living room" }
        Caps {
            anchors.right: parent.right; anchors.rightMargin: content.margin; y: content.margin
            visible: !!board.info.weather
            color: board.soft
            text: board.info.weather
                ? board.info.weather.temp + "°  " + board.info.weather.label + "  ·  feels " + board.info.weather.feels + "°"
                : ""
        }

        // A spending halt outranks everything else on the page.
        Rectangle {
            visible: !!board.info.halt
            x: content.margin; y: content.margin + 4 * board.u
            width: parent.width - 2 * content.margin; height: 5 * board.u
            color: Qt.rgba(board.amber.r, board.amber.g, board.amber.b, 0.16)
            border.color: board.amber; border.width: 1
            Text {
                anchors.centerIn: parent
                font.family: board.sans; font.pixelSize: Math.round(1.9 * board.u); font.weight: Font.DemiBold
                color: board.amber
                text: "■  CFO halt is on: all agent spend is paused" + (board.info.halt && board.info.halt.reason ? "  ·  " + board.info.halt.reason : "")
            }
        }

        // Hero: greeting, time, date.
        Column {
            id: hero
            x: content.margin
            width: parent.width - content.sideWidth - 3 * content.margin
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: -2 * board.u
            spacing: 0

            Text {
                font.family: board.serifItalic; font.italic: true
                font.pixelSize: Math.round(4.6 * board.u)
                color: board.soft
                text: board.greeting(board.now) + ", " + (board.info.name || "Bilal") + "."
            }

            Item {
                width: parent.width
                height: timeText.implicitHeight * 0.80
                Text {
                    id: timeText
                    y: -implicitHeight * 0.08
                    x: -1.2 * board.u
                    font.family: board.sans
                    font.pixelSize: Math.round(33 * board.u)
                    // Inter ships as one variable file; ask for the hairline cut by axis.
                    font.variableAxes: { "wght": 200, "opsz": 32 }
                    font.letterSpacing: -1.1 * board.u
                    font.features: { "tnum": 1 }
                    color: board.ink
                    text: board.clock(board.now)
                }
                Text {
                    anchors.left: timeText.right; anchors.leftMargin: 1.6 * board.u
                    anchors.baseline: timeText.baseline
                    font.family: board.sans; font.pixelSize: Math.round(3.0 * board.u)
                    font.weight: Font.Medium; font.letterSpacing: 0.3 * board.u
                    color: board.accent
                    text: board.meridiem(board.now)
                }
            }

            Text {
                font.family: board.serif
                font.pixelSize: Math.round(7.2 * board.u)
                color: board.ink
                text: Qt.formatDate(board.now, "dddd, MMMM d")
            }

            Item { width: 1; height: 3.4 * board.u }

            // The day as a line: daylight in accent, a tick where we are now.
            Item {
                id: dayLine
                width: parent.width; height: 4.6 * board.u
                readonly property real rise: board.sunrise ? board.dayFraction(board.sunrise) : 0.28
                readonly property real set: board.sunset ? board.dayFraction(board.sunset) : 0.72

                Rule { width: parent.width; y: 0.9 * board.u }
                Rectangle {
                    x: dayLine.width * dayLine.rise; y: 0.9 * board.u - 1
                    width: dayLine.width * (dayLine.set - dayLine.rise); height: 3
                    color: board.accent; opacity: 0.75
                }
                Rectangle {
                    x: Math.round(dayLine.width * board.dayFraction(board.now)) - 1; y: 0
                    width: 2; height: 1.8 * board.u + 1
                    color: board.ink
                }
                Caps {
                    x: dayLine.width * dayLine.rise; y: 2.4 * board.u
                    visible: !!board.sunrise
                    text: board.sunrise ? "Sunrise " + board.clock(board.sunrise) : ""
                }
                Caps {
                    x: dayLine.width * dayLine.set - width; y: 2.4 * board.u
                    visible: !!board.sunset
                    text: board.sunset ? "Sunset " + board.clock(board.sunset) : ""
                }
                Caps {
                    anchors.right: parent.right; y: 2.4 * board.u
                    text: "Day " + board.dayOfYear(board.now) + " of " + board.daysInYear(board.now)
                }
            }
        }

        // What is waiting for a person, one line at a time.
        Item {
            id: note
            visible: board.notes.length > 0
            x: content.margin
            width: hero.width
            anchors.bottom: parent.bottom; anchors.bottomMargin: content.margin
            height: 2.6 * board.u
            readonly property var current: board.notes.length ? board.notes[board.noteIndex % board.notes.length] : null

            Row {
                id: noteRow
                spacing: 1.6 * board.u
                Caps {
                    id: noteTag
                    anchors.verticalCenter: parent.verticalCenter
                    color: note.current && note.current.alert ? board.amber : board.accent
                    text: note.current ? note.current.tag : ""
                }
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: note.width - noteTag.width - noteRow.spacing
                    elide: Text.ElideRight
                    font.family: board.sans; font.pixelSize: Math.round(1.9 * board.u)
                    color: board.soft
                    text: note.current ? note.current.text : ""
                }
            }

            SequentialAnimation {
                id: turnNote
                NumberAnimation { target: noteRow; property: "opacity"; to: 0; duration: 700 }
                ScriptAction { script: board.noteIndex = (board.noteIndex + 1) % Math.max(1, board.notes.length) }
                NumberAnimation { target: noteRow; property: "opacity"; to: 1; duration: 900 }
            }
            Timer { interval: 14000; repeat: true; running: !board.instant && board.notes.length > 1; onTriggered: turnNote.restart() }
        }

        // Side column: calendar, systems, allowance.
        Column {
            id: side
            width: content.sideWidth
            anchors.right: parent.right; anchors.rightMargin: content.margin
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 1.2 * board.u
            spacing: 1.5 * board.u

            // Month.
            Item {
                width: parent.width; height: monthName.height
                Text {
                    id: monthName
                    font.family: board.serif; font.pixelSize: Math.round(3.6 * board.u)
                    color: board.ink
                    text: Qt.formatDate(board.now, "MMMM")
                }
                Caps {
                    anchors.right: parent.right; anchors.baseline: monthName.baseline
                    text: Qt.formatDate(board.now, "yyyy") + "  ·  Week " + board.isoWeek(board.now)
                }
            }

            Grid {
                id: month
                columns: 7
                width: parent.width
                readonly property real cell: width / 7
                readonly property int year: board.now.getFullYear()
                readonly property int monthIndex: board.now.getMonth()
                readonly property int lead: new Date(year, monthIndex, 1).getDay()
                readonly property int days: new Date(year, monthIndex + 1, 0).getDate()

                Repeater {
                    model: ["S", "M", "T", "W", "T", "F", "S"]
                    Item {
                        width: month.cell; height: 2.6 * board.u
                        Caps { anchors.centerIn: parent; text: modelData; font.letterSpacing: 0 }
                    }
                }
                Repeater {
                    model: Math.ceil((month.lead + month.days) / 7) * 7
                    Item {
                        id: dayCell
                        readonly property int day: index - month.lead + 1
                        readonly property bool real: day >= 1 && day <= month.days
                        readonly property bool today: real && day === board.now.getDate()
                        readonly property bool weekend: index % 7 === 0 || index % 7 === 6
                        width: month.cell; height: 3.0 * board.u
                        Rectangle {
                            visible: dayCell.today
                            anchors.centerIn: parent
                            width: 2.8 * board.u; height: 2.8 * board.u
                            color: board.accent
                        }
                        Text {
                            anchors.centerIn: parent
                            visible: dayCell.real
                            font.family: board.sans; font.pixelSize: Math.round(1.75 * board.u)
                            font.weight: dayCell.today ? Font.Bold : Font.Normal
                            font.features: { "tnum": 1 }
                            color: dayCell.today ? board.base : (dayCell.day < board.now.getDate() || dayCell.weekend ? board.dim : board.soft)
                            text: dayCell.day
                        }
                    }
                }
            }

            // Agenda, when a calendar feed is linked.
            Rule { width: parent.width; visible: board.events.length > 0 }
            Column {
                width: parent.width
                visible: board.events.length > 0
                spacing: 1.0 * board.u
                Caps { text: "Up next" }
                Repeater {
                    model: board.events.slice(0, 3)
                    Item {
                        id: eventRow
                        readonly property date start: new Date(modelData.start)
                        width: side.width; height: 2.5 * board.u
                        Text {
                            id: eventWhen
                            width: 20 * board.u
                            anchors.verticalCenter: parent.verticalCenter
                            font.family: board.sans; font.pixelSize: Math.round(1.7 * board.u)
                            font.features: { "tnum": 1 }
                            color: board.sameDay(eventRow.start, board.now) ? board.accent : board.dim
                            text: board.eventDay(eventRow.start) + (modelData.allDay ? "" : "  " + board.clock(eventRow.start) + " " + board.meridiem(eventRow.start))
                        }
                        Text {
                            anchors.left: eventWhen.right; anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            elide: Text.ElideRight
                            font.family: board.sans; font.pixelSize: Math.round(1.85 * board.u)
                            color: board.ink
                            text: modelData.title
                        }
                    }
                }
            }

            // Systems.
            Rule { width: parent.width }
            Column {
                width: parent.width
                spacing: 1.0 * board.u
                Caps { text: "Systems" }
                Repeater {
                    model: board.systems
                    Item {
                        id: systemRow
                        readonly property bool fine: modelData.level === "ok"
                        readonly property color tone: fine ? board.accent : (modelData.level === "unknown" ? board.dim : board.amber)
                        width: side.width; height: 2.5 * board.u
                        // Healthy is a filled dot, a warning a hollow ring, an alert a
                        // solid square: readable without telling colours apart.
                        Rectangle {
                            id: mark
                            anchors.verticalCenter: parent.verticalCenter
                            width: 0.95 * board.u; height: width
                            radius: modelData.level === "alert" ? 0 : width / 2
                            color: modelData.level === "warn" || modelData.level === "unknown" ? "transparent" : systemRow.tone
                            border.color: systemRow.tone; border.width: Math.max(1, Math.round(0.18 * board.u))
                        }
                        Text {
                            id: systemLabel
                            anchors.left: mark.right; anchors.leftMargin: 1.3 * board.u
                            anchors.verticalCenter: parent.verticalCenter
                            font.family: board.sans; font.pixelSize: Math.round(1.85 * board.u)
                            color: board.ink
                            text: modelData.label
                        }
                        Text {
                            anchors.left: systemLabel.right; anchors.leftMargin: 1.4 * board.u
                            anchors.right: systemValue.left; anchors.rightMargin: 1.4 * board.u
                            anchors.verticalCenter: parent.verticalCenter
                            horizontalAlignment: Text.AlignRight
                            elide: Text.ElideRight
                            font.family: board.sans; font.pixelSize: Math.round(1.6 * board.u)
                            color: board.dim
                            text: modelData.detail || ""
                        }
                        Text {
                            id: systemValue
                            anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            font.family: board.sans; font.pixelSize: Math.round(1.85 * board.u)
                            font.weight: systemRow.fine ? Font.Normal : Font.DemiBold
                            color: systemRow.fine ? board.soft : board.amber
                            text: modelData.value
                        }
                    }
                }
            }

            // Board counts, set like figures in a magazine sidebar.
            Rule { width: parent.width; visible: !!board.info.board }
            Row {
                visible: !!board.info.board
                width: parent.width
                Repeater {
                    model: board.info.board ? [
                        { n: board.info.board.readyForQa, label: "Ready for QA" },
                        { n: board.info.board.inProgress, label: "In progress" },
                        { n: board.info.board.todo, label: "To do" }
                    ] : []
                    Column {
                        width: side.width / 3
                        spacing: 0.2 * board.u
                        Text {
                            font.family: board.serif; font.pixelSize: Math.round(4.4 * board.u)
                            color: index === 0 && modelData.n > 0 ? board.accent : board.ink
                            text: modelData.n
                        }
                        Caps { text: modelData.label; font.letterSpacing: 0.14 * board.u }
                    }
                }
            }

            // Allowance.
            Rule { width: parent.width; visible: !!board.info.allowance }
            Column {
                visible: !!board.info.allowance
                width: parent.width
                spacing: 1.1 * board.u
                readonly property var pool: board.info.allowance || ({ usedOf100: 0, resetHours: 0, label: "", level: "ok" })
                readonly property color tone: pool.level === "ok" ? board.accent : board.amber
                Item {
                    width: parent.width; height: allowanceLabel.height
                    Caps { id: allowanceLabel; text: parent.parent.pool.label }
                    Caps {
                        anchors.right: parent.right
                        color: board.soft
                        text: parent.parent.pool.usedOf100 + " of 100 used"
                    }
                }
                Item {
                    width: parent.width; height: 3
                    Rule { width: parent.width; y: 1 }
                    Rectangle { width: parent.width * Math.min(100, parent.parent.pool.usedOf100) / 100; height: 3; color: parent.parent.tone }
                }
                Item {
                    width: parent.width; height: resetLabel.height
                    Caps { id: resetLabel; text: "Resets in " + parent.parent.pool.resetHours + " h" }
                    Caps {
                        anchors.right: parent.right
                        visible: !!board.info.generatedAt
                        text: board.info.generatedAt
                            ? "Updated " + board.clock(new Date(board.info.generatedAt)) + " " + board.meridiem(new Date(board.info.generatedAt))
                            : ""
                    }
                }
            }
        }
    }

    function isoWeek(d) {
        var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
        var day = t.getUTCDay() || 7
        t.setUTCDate(t.getUTCDate() + 4 - day)
        var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
        return Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
    }
}
