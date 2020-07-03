local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser

local parsed = CommandAstParser.new([[
    # Regular Commands
    cmd hello there
    cmd "Hello there"
    cmd 'Hello there!!'
    cmd 1337

    # Cooler Commands
    cmd -kEwL --cool yes
    cmd --something yes -ok cool

    # Binary Expression Commands
    cmd one && cmd --number two
    cmd with-pipe | yes

    # Support Multiline
    cmd one \
        two \
        three

    # Support Interpolated Strings and Variables
    cmd $spartaName
    echo "Hello, $player!"
]]):Parse()
CommandAstParser:prettyPrint(parsed)

local parsed2 = CommandAstParser.new([[
    echo "Hello, World!"
]]):Parse()
CommandAstParser:prettyPrint(parsed2)