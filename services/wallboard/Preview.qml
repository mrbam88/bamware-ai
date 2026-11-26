// Offscreen still of the board, for checking a design change without taking
// over a display. Run through bin/preview.
import QtQuick
import QtQuick.Window

Window {
    id: window
    width: Number(Qt.application.arguments[Qt.application.arguments.length - 3])
    height: Number(Qt.application.arguments[Qt.application.arguments.length - 2])
    visible: true
    color: "black"

    readonly property string dataPath: Qt.application.arguments[Qt.application.arguments.length - 1]

    Board {
        id: board
        anchors.fill: parent
        instant: true
    }

    Component.onCompleted: {
        var request = new XMLHttpRequest()
        request.open("GET", "file://" + dataPath, false)
        request.send()
        var parsed = JSON.parse(request.responseText)
        if (parsed.previewNow) board.now = new Date(parsed.previewNow)
        board.info = parsed
    }

    Timer {
        interval: 1200; running: true
        onTriggered: board.grabToImage(function(result) {
            result.saveToFile(window.dataPath.replace(/\.json$/, ".png"))
            Qt.quit()
        })
    }
}
