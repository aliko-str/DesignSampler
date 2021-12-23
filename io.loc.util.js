const fs = require("fs");
const path = require("path");
const _ = require("underscore");


function init(profileName){
	const profileRoot = path.join(__dirname, "profiles", profileName);
	const jobProgressF = path.join(profileRoot, "jobProgress.json");
	const pageModsF = path.join(profileRoot, "myPageMods.js");
	const locSettF = path.join(profileRoot, "locSettings.json");
	
	async function saveJobProgressArr(jobProgress) {
		// make it readable
		const jobProgressStr = JSON.stringify(jobProgress).replace(/,"/gi, "\t").replace(/},/gi, "\n");
		return await fs.promises.writeFile(jobProgressF, jobProgressStr, "utf8");
	}

	async function readJobProgressArr() {
		const jobProgressStr = await fs.promises.readFile(jobProgressF, "utf8");
		const jobProgress = JSON.parse(jobProgressStr.replace(/\t/gi, ",\"").replace(/\n/gi, "},"));
		return jobProgress;
	}

	async function savePageMods(pageMods) {
		const toBeSavedObj = _.mapObject(pageMods, (val, key) => {
			return val.toString();
		});
		const toBeSavedStr = "module.exports = {" + _.pairs(toBeSavedObj).map(x => ("\"" + x[0] + "\": " + x[1])).join(",\n") + "}";
		return await fs.promises.writeFile(pageModsF, toBeSavedStr, "utf8");
	}
	
	function readPageMods(){
		const savedPageMods = require(pageModsF);
		return _.mapObject(savedPageMods, (val, key) => {
			return val.toString();
		});
	}
	
	async function readSettings(){
		const locSettings = JSON.parse(await fs.promises.readFile(locSettF, "utf8"));
		return locSettings;
	}
	
	return {
		readPageMods: readPageMods,
		savePageMods: savePageMods,
		readJobProgressArr: readJobProgressArr,
		saveJobProgressArr: saveJobProgressArr,
		readSettings: readSettings
	};
}

module.exports = {
	init: init
};
