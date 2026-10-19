// The same plan bytes on every platform. Bun's JavaScriptCore takes Math.sin and the other trigonometric functions from
// the platform's libm, whose last bit differs between macOS and Linux (Math.sin(2.0989444255828857) is
// 0.8637417882724919 on macOS and 0.8637417882724918 on Linux). Flight-line corner joins amplify that to millimetres,
// so a plan made on a Mac differed from the same plan made in CI. These replacements are the FreeBSD msun (fdlibm)
// algorithms in plain IEEE-754 arithmetic, which gives the same bits everywhere, as V8 does with its own fdlibm port.
// They replace Math's own because Turf calls Math directly.
import acos from '@stdlib/math-base-special-acos'
import asin from '@stdlib/math-base-special-asin'
import atan2 from '@stdlib/math-base-special-atan2'
import cos from '@stdlib/math-base-special-cos'
import sin from '@stdlib/math-base-special-sin'
import tan from '@stdlib/math-base-special-tan'

Object.assign(Math, { acos, asin, atan2, cos, sin, tan })
