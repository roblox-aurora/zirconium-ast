local TS = require(script.Parent.CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, script.Parent, "CommandLib")
local CommandAstParser = CommandLib.CommandAstParser

local parsed = CommandAstParser.new([[
    same-line hello; same-line world
    regular hello world
    numeric 11
    double-quote "this is a long string"
    single-quote 'hi there lol'
    options -abC ccc --longName value
    variables $player
    test & value; test2 & value2 & yo
]]):Parse()
CommandAstParser:prettyPrint(parsed)

-- local parsed2 = CommandAstParser.new("test 10; split 'by a semicolon'"):Parse()
-- CommandAstParser:prettyPrint(parsed2)