// NOTE: we'll make it a loadable module for now -- no need to any fancy communication yet

const { spawn } = require("child_process");
const path = require("path");

const rBin = "/Library/Frameworks/R.framework/Versions/3.6/Resources/Rscript";

function callRAsync(script, inputDatObj){
	const args = ["--vanilla", script];
	const options = {
		env: Object.assign({DIRNAME: __dirname, inDat: JSON.stringify(inputDatObj)}, process.env),
		encoding: "utf8"
	};
	return new Promise(function(resolve, reject) {
		const child = spawn(rBin, args, options);
		var rOutput = "";
		var errOut = "";
		child.stderr.on("data", (e)=>{
			errOut+=e;
			// console.error("stderr: ", e);
			// reject(e);
		});
		child.stdout.on("data", function(d) {
			 rOutput += d;
		});
		child.on("close", function(code) {
			// console.error("Code:", code);
			// console.error("rOutput", rOutput);
			// console.error("errOut", errOut);
			if(errOut.length){
				console.error("Code:", code);
				console.error("rOutput", rOutput);
				console.error("errOut", errOut);
				return reject(errOut);
			}
			try {
				resolve(JSON.parse(rOutput));	
			} catch (e) {
				console.error(e);
				reject(e);
			}
		});
	});
}

function doInRAsync(action, paramObj){
	switch (action) {
		case "RequestClustering":
			return callRAsync(path.join(__dirname, "hClustFrames.R"), paramObj);
			break;
		default:
			throw new Error("Unknown R action requested");
	}
}

module.exports = {
	doInRAsync: doInRAsync
};

