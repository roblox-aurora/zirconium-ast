--!strict
local TS = require(game:GetService("ReplicatedStorage").CommandLib.vendor.RuntimeLib)
local CommandLib = TS.import(script, game:GetService("ReplicatedStorage"), "CommandLib")
local hl = CommandLib.ZrRichTextHighlighter

type Array<T> = {[number]: T}
type Props = {[string]: any, Parent: Instance?}

local function createElement(class: string, props: Props, children: Array<Instance>): Instance
    local inst = Instance.new(class)
    if props ~= nil and type(props) == "table" then
        for key, value in pairs(props) do
            if key ~= "Parent" then
                inst[key] = value
            end
        end
        if props.Parent then
            inst.Parent = props.Parent
        end
    end
    if children ~= nil and type(children) == "table" then
        for _, child in ipairs(children) do
            child.Parent = inst
        end
    end
    return inst
end

local source = [[
# keywords
if, else, for, in, function, let, 
export, const, delete, undefined,
new, continue, while, return,
default, null, nil,
import, set, get,
try, catch, finally,
do, from, throw

# Variables
$x = 10
let y = 10
const z = 20

# Functions
function regularFunction($var) {
    return true
}
const variableFunction = function($var) {
    return "uses FunctionExpression $var"
}
]]

createElement("ScreenGui", {
    Parent = game.Players.LocalPlayer.PlayerGui
}, {
    createElement("TextLabel", {
		RichText = true,
		Text = hl.new(source):parse(),
		TextXAlignment = "Left",
		TextYAlignment = "Top",
		Font = "Code",
		TextSize = 18,
		TextColor3 = Color3.fromRGB(198, 204, 215),
		Size = UDim2.new(0, 500, 1, 0),
		BackgroundColor3 = Color3.fromRGB(33, 37, 43)
	}, {}),
})