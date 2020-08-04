local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser
local ast = CommandLib.ast
local CommandAstInterpreter = CommandLib.CommandAstInterpreter

local parsed = CommandAstParser.new([[
    # Regular Commands
    cmd hello there
    cmd "Hello there"
    cmd 'Hello there!!'
    cmd 1337

    cmd --test "Hello, $player!"

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
    echo "$player"
    echo "Hello, $player you're awesome!"

    # PrefixExpression handling
    echo ~one @two %four ^five &six *seven !eight !"Testing lol" "~This should be a string"
]], {
    prefixExpressions = true
}):Parse()
CommandAstParser:prettyPrint({parsed})
-- print(CommandAstParser:render(parsed))