import { GetCommandService, Command, PlayerType } from "@rbxts/cmd-core";
import { CmdPrimitiveType } from "@rbxts/cmd-core/CommandType";
const Registry = GetCommandService("RegistryService");
const Dispatch = GetCommandService("DispatchService");

function shallowPrint(obj: object) {
	if (typeIs(obj, "table")) {
		const str = new Array<string>();
		for (const [k, v] of Object.entries(obj)) {
			if (typeIs(v, "table")) {
				str.push(`${k}: table`);
			} else {
				str.push(`${k}: ${v}`);
			}
		}
		
		print(`[ ${str.join(",")} ]`);
	} else {
		print(obj);
	}
}

Registry.RegisterCommand(Command.create({
	command: "test",
	options: {
		print: {type: CmdPrimitiveType.Switch, alias: ["p"]},
		prefix: {type: CmdPrimitiveType.String, default: "Output: "}
	},
	execute({Options, Arguments}, executor) {
		print(Options.prefix, executor, game.GetService("HttpService").JSONEncode(Options));
		
		if (Options.print) {
			print(Options.prefix, game.GetService("HttpService").JSONEncode(Arguments));
		}
	}
}));

game.GetService("Players").PlayerAdded.Connect((plr) => {
	plr.Chatted.Connect((message) => {
		if (message.sub(0,0) === "/") {
			const command = message.sub(1);
			Dispatch.Execute(command, plr);
		}
	})
});