import AppKit

let canvas = NSSize(width: 512, height: 512)
let image = NSImage(size: canvas)

image.lockFocus()

NSColor(calibratedRed: 1.0, green: 0.973, blue: 0.914, alpha: 1.0).setFill()
NSBezierPath(roundedRect: NSRect(origin: .zero, size: canvas), xRadius: 112, yRadius: 112).fill()

NSColor(calibratedRed: 0.875, green: 0.949, blue: 0.91, alpha: 1.0).setFill()
NSBezierPath(ovalIn: NSRect(x: 68, y: 68, width: 376, height: 376)).fill()

let center = NSPoint(x: 256, y: 256)
let star = NSBezierPath()
for index in 0..<10 {
    let angle = -Double.pi / 2 + Double(index) * Double.pi / 5
    let radius = index.isMultiple(of: 2) ? 173.0 : 86.0
    let point = NSPoint(
        x: center.x + CGFloat(cos(angle) * radius),
        y: center.y - CGFloat(sin(angle) * radius)
    )
    if index == 0 { star.move(to: point) } else { star.line(to: point) }
}
star.close()
star.lineJoinStyle = .round
star.lineWidth = 19
NSColor(calibratedRed: 1.0, green: 0.839, blue: 0.376, alpha: 1.0).setFill()
NSColor(calibratedRed: 0.149, green: 0.224, blue: 0.2, alpha: 1.0).setStroke()
star.fill()
star.stroke()

let ink = NSColor(calibratedRed: 0.149, green: 0.224, blue: 0.2, alpha: 1.0)
ink.setFill()
NSBezierPath(ovalIn: NSRect(x: 193, y: 278, width: 16, height: 16)).fill()
NSBezierPath(ovalIn: NSRect(x: 303, y: 278, width: 16, height: 16)).fill()

let smile = NSBezierPath()
smile.move(to: NSPoint(x: 205, y: 261))
smile.curve(
    to: NSPoint(x: 307, y: 261),
    controlPoint1: NSPoint(x: 232, y: 225),
    controlPoint2: NSPoint(x: 280, y: 225)
)
smile.lineWidth = 16
smile.lineCapStyle = .round
ink.setStroke()
smile.stroke()

image.unlockFocus()

guard
    CommandLine.arguments.count > 1,
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let png = bitmap.representation(using: .png, properties: [:])
else {
    fatalError("Could not render icon")
}

try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
