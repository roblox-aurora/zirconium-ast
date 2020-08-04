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
    echo "Hello, please \"escape me\" thanks."

    # PrefixExpression handling
    echo ~one @two %four ^five &six *seven !eight !"Testing lol" "~This should be a string"
    echo !"break me up, break me up $inside"
    echo ~\$saveMe \~$saveMeFromTheBugIveBecome # Since identifiers shouldn't mix with PrefixExpressions

    # Variable declaration
    $v = 20
    $a = "Hello $playerName!"
    $c = What\ the\ hack\ is\ this
]], {
    prefixExpressions = true,
    variableDeclarations = true
}):Parse()
print(CommandAstParser:render(parsed))
CommandAstParser:prettyPrint({parsed})
