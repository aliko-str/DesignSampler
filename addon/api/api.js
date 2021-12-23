/*global Components XPCOMUtils ExtensionCommon ExtensionAPI*/

const {
	classes: Cc,
	interfaces: Ci,
	utils: Cu
} = Components;


this.gTab = class extends ExtensionAPI {
	getAPI(context) {
		var _pastOnTabOpen;
		return {
			gTab: {
				startResizingBrowserTabsTo: (width, height) => {
					// sets default/min size for our 'virtual' browser window
					const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
					const gbr = wm.getMostRecentWindow("navigator:browser").gBrowser;
					const container = gbr.tabContainer;
					if(_pastOnTabOpen !== undefined){
						console.log("Already resizing - cancelling past effects; assigning new width/height to use");
						container.removeEventListener("TabOpen", _pastOnTabOpen, false);
					}
					var br;
					_pastOnTabOpen = (ev) => {
						br = gbr.getBrowserForTab(ev.target);
						br.style.setProperty("width", width + "px", "important");
						br.style.setProperty("min-height", height + "px", "important");
						// br.style.setProperty("border", "red dashed 4px", "important"); //for testing purposes
						console.log("[NEW Api] Resining new tab to: ", width, "by", height);
					};
					container.addEventListener("TabOpen", _pastOnTabOpen, false);
					return undefined;
					// function resizeCurrTabF(h){
					// 	// NOTE: This will only work for 1 tab - which interfers with our attempts at screenshotting several tabs at once -- we'll stick with the single-tab solution for now -- to tired to fix
					// 	//// FIXME: Make it multi-tab
					// 	// F changes the Height of tab to be "full-page" - so bottom-screen sticky elements dont interfer with the full-page screenshots
					// 	console.assert(h >= height, "[RESIZING API] We can't have a new window height be less than the originally requested, global 'height' in settings; requested height:", h, "settings' height:", height);
					// 	br.style.setProperty("height", h + "px", "important");
					// }
					// return resizeCurrTabF;
				},
				makeTabFullHeight: (tabLabelId, h)=>{
					// sets a page to be the hight of its content - otherwise sticky footers are screenshotted as mid-window
					// NOTE: we can't use it -- this will affect CSS units (vh, vmin/vmax) and website's tablet detection (vertical screen position etc) ==> detect bottom sticky menus and attach them to bottom of the page
					const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
					const gbr = wm.getMostRecentWindow("navigator:browser").gBrowser;
					console.log(gbr);
					const container = gbr.tabContainer;
					console.log("[makeTabFullHeight] Before forEach");
					const actualTabContainer = Array.from(container.childNodes).find(el=>el.tagName.toLowerCase() === "arrowscrollbox");
					actualTabContainer.childNodes.forEach((tab, i) => {
						// console.log("[makeTabFullHeight] a tab:", tab);
						const isThisTheTab = Array.from(tab.attributes).some(attr=>attr.name.toLowerCase() === "label" && attr.value === tabLabelId);
						if(isThisTheTab){
							console.log("[makeTabFullHeight] Found the tab and attribute; setting height", h, "px");
							const br = gbr.getBrowserForTab(tab);
							br.style.setProperty("height", h + "px", "important");
							// tab.style.setProperty("height", h + "px", "important");
						}
					});
				},
				
				stopResizingBrowserTabsTo: () => {
					const wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
					const gbr = wm.getMostRecentWindow("navigator:browser").gBrowser;
					const container = gbr.tabContainer;
					if(_pastOnTabOpen !== undefined){
						console.log("No longer resizing");
						container.removeEventListener("TabOpen", _pastOnTabOpen, false);
					}
				}
			}
		};
	}
};
