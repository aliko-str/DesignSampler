
const roots2update = ["www.fsbhendricks.com.png",
	"www.peoplesbank-wa.com.png",
	"www.drummondbank.com.png",
	"www.1stnorthernbank.com.png",
	"www.pathfinderbank.com.png",
	"www.fdsb.com.png",
	"www.fssbtexas.com.png",
	"www.accessbank.com.png",
	"www.fsbpondcreek.com.png",
	"www.concordiabank.com.png",
	"www.bankpfb.com.png",
	"www.cbeldon.com.png",
	"www.libertyfirst.us.png",
	"www.secbank.net.png",
	"www.americanexpress.com.png",
	"www.havenbank.com.png",
	"www.firstbusiness.com.png",
	"www.wvbk.com.png",
	"www.exba.com.png",
	"www.itascabank.com.png",
	"www.tnbbank.net.png",
	"www.ambanking.com.png",
	"www.covcobank.com.png"].map(str=>str.replace(".png", ""));
	
const f2update = "/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/profiles/Banks_New_0/jobProgress.json";

const fs = require("fs/promises");

(function main(){
	fs.readFile(f2update, 'utf8')
		// .then(str=>{
		// 	console.log(str);
		// 	return str;
		// })
		.then(str=>str.split("\n"))
		.then(strArr=>{
			let counter = 0;
			return strArr.map(row=>{
				if(roots2update.some(root=>row.indexOf(root) > -1)){
					// update code here
					console.assert(row.indexOf('allDone":true') > -1, "Failed allDone fool check for row", row);
					row = row.replace('allDone":true', 'allDone":false');
					console.log(++counter, "[DONE row]",  row);
				}
				return row;
			});
		})
		.then(newStrArr=>newStrArr.join("\n"))
		.then(newStr=>fs.writeFile(f2update, newStr))
		.then(()=>console.log("ALL DONE"))
		.catch(err=>console.error(err));
})();
