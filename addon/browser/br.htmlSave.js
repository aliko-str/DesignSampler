/*global chrome*/
/*eslint-env browser*/
/*global browser*/

/************************************************************************/
/*                                                                      */
/*  Notes on Save Page WE Operation                                     */
/*                                                                      */
/*  1. The basic approach is to identify all frames in the page and     */
/*     then traverse the DOM tree in three passes.                      */
/*                                                                      */
/*  2. The current states of the HTML elements are extracted from       */
/*     the DOM tree. External resources are downloaded and scanned.     */
/*                                                                      */
/*  3. A content script in each frame finds and sets keys on all        */
/*     sub-frame elements that are reachable from that frame.           */
/*                                                                      */
/*  4. The first pass gathers external style sheet resources:           */
/*                                                                      */
/*     - <style> element: find style sheet url()'s in @import rules,    */
/*       then remember locations.                                       */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: find style sheet   */
/*       url()'s in @import rules, then remember locations.             */
/*                                                                      */
/*  5. After the first pass, the referenced external style sheets are   */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  6. The second pass gathers external script/font/image resources:    */
/*                                                                      */
/*     - <script> element: remember location from src attribute.        */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: remember location        */
/*       from href attribute.                                           */
/*                                                                      */
/*     - <img> element: remember location from src attribute.           */
/*                                                                      */
/*     if just saving currently displayed CSS images:                   */
/*                                                                      */
/*     - all elements: find url()'s in CSS computed style for element   */
/*       and for before/after pseudo-elements and remember locations.   */
/*                                                                      */
/*     otherwise, if saving all CSS images:                             */
/*                                                                      */
/*     - style attribute on any element: find image url()'s in CSS      */
/*       rules and remember locations.                                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then find font and      */
/*       image url()'s in CSS rules and remember locations.             */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then find font and image url()'s in CSS rules and       */
/*       remember locations.                                            */
/*                                                                      */
/*  7. After the second pass, the referenced external resources are     */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  8. The third pass generates HTML and data uri's:                    */
/*                                                                      */
/*     - style attribute on any element: replace image url()'s in       */
/*       CSS rules with data uri's.                                     */
/*                                                                      */
/*     - <script> element: Javascript is not changed.                   */
/*                                                                      */
/*     - <script src="..."> element: convert Javascript to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then replace font and   */
/*       image url()'s in CSS rules with data uri's.                    */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then replace font and image url()'s in CSS rules        */
/*       with data uri's, then enclose in new <style> element and       */
/*       replace original <link> element.                               */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: convert icon to data     */
/*       uri and use this to replace url in href attribute.             */
/*                                                                      */
/*     - <base href="..." target="..."> element: remove existing        */
/*       base element (if any) and insert new base element with href    */
/*       attribute set to document.baseURI and target attribute set     */
/*       to the same value as for removed base element (if any).        */
/*                                                                      */
/*     - <body background="..."> element: convert image to data uri     */
/*       and use this to replace url in background attribute.           */
/*                                                                      */
/*     - <img src="..."> element: convert current source image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <img srcset="..."> element: replace list of images in srcset   */
/*       attribute by empty string.                                     */
/*                                                                      */
/*     - <input type="image" src="..."> element: convert image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <input type="file"> or <input type="password"> element:        */
/*       no changes made to maintain security.                          */
/*                                                                      */
/*     - <input type="checkbox"> or <input type="radio"> element:       */
/*       add or remove checked attribute depending on the value of      */
/*       element.checked reflecting any user changes.                   */
/*                                                                      */
/*     - <input type="-other-"> element: add value attribute set to     */
/*       element.value reflecting any user changes.                     */
/*                                                                      */
/*     - <canvas> element: convert graphics to data uri and use this    */
/*       to define background image in style attribute.                 */
/*                                                                      */
/*     - <audio src="..."> element: if current source, convert audio    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video src="..."> element: if current source, convert video    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video poster="..."> element: convert image to data uri and    */
/*       use this to replace url in poster attribute.                   */
/*                                                                      */
/*     - <source src="..."> element in <audio> or <video> element:      */
/*       if current source, convert audio or video to data uri and      */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <source srcset="..."> element in <picture> element: replace    */
/*       list of images in srcset attribute by empty string.            */
/*                                                                      */
/*     - <track src="..."> element: convert subtitles to data uri and   */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <object data="..."> element: convert binary data to data uri   */
/*       and use these to replace url in data attribute.                */
/*                                                                      */
/*     - <embed src="..."> element: convert binary data to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <frame src="..."> element: process sub-tree to extract HTML,   */
/*       then convert HTML to data uri and use this to replace url in   */
/*       src attribute.                                                 */
/*                                                                      */
/*     - <iframe src="..."> or <iframe srcdoc="..."> element: process   */
/*       sub-tree to extract HTML, then convert HTML to text and use    */
/*       this to replace text in srcdoc attribute or to create new      */
/*       srcdoc attribute.                                              */
/*                                                                      */
/*     - <iframe src="..."> element: replace url in srcdoc attribute    */
/*       by empty string.                                               */
/*                                                                      */
/*     - other elements: process child nodes to extract HTML.           */
/*                                                                      */
/*     - text nodes: escape '<' and '>' characters.                     */
/*                                                                      */
/*     - comment nodes: enclose within <!-- and  -->                    */
/*                                                                      */
/*  9. Data URI syntax and defaults:                                    */
/*                                                                      */
/*     - data:[<media type>][;base64],<encoded data>                    */
/*                                                                      */
/*     - where <media type> is: <mime type>[;charset=<charset>]         */
/*                                                                      */
/*     - default for text content: text/plain;charset=US-ASCII          */
/*                                                                      */
/*     - default for binary content: application/octet-stream;base64    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of Binary Data and Characters                              */
/*                                                                      */
/*  1. Files downloaded by XMLHttpRequest GET request are received      */
/*     as a Uint8Array (8-bit unsigned integers) representing:          */
/*     - either binary data (image, font, audio or video)               */
/*     - or encoded characters (style sheets or scripts)                */
/*                                                                      */
/*  2. The Uint8Array is then converted to a Javascript string          */
/*     (16-bit unsigned integers) containing 8-bit unsigned values      */
/*     (a binary string) which is sent to the content script.           */
/*                                                                      */
/*  3. A binary string containing binary data is copied directly        */
/*     into the resourceContent array.                                  */
/*                                                                      */
/*  4. A binary string containing UTF-8 characters is converted to      */
/*     a normal Javascript string (containing UTF-16 characters)        */
/*     before being copied into the resourceContent array.              */
/*                                                                      */
/*  5. A binary string containing non-UTF-8 (ASCII, ANSI, ISO-8859-1)   */
/*     characters is copied directly into the resourceContent array.    */
/*                                                                      */
/*  6. When creating a Base64 data uri, the binary string from the      */
/*     resourceContent array is converted to a Base64 ASCII string      */
/*     using btoa().                                                    */
/*                                                                      */
/*  7. When creating a UTF-8 data uri, the UTF-16 string from the       */
/*     resourceContent array is converted to a UTF-8 %-escaped          */
/*     string using encodeURIComponent(). The following characters      */
/*     are not %-escaped: alphabetic, digits, - _ . ! ~ * ' ( )         */
/*                                                                      */
/*  8. Character encodings are determined as follows:                   */
/*     - UTF-8 Byte Order Mark (BOM) at the start of a text file        */
/*     - charset parameter in the HTTP Content-Type header field        */
/*     - @charset rule at the start of a style sheet                    */
/*     - charset attribute on an element referencing a text file        */
/*     - charset encoding of the parent document or style sheet         */
/*                                                                      */
/************************************************************************/


/************************************************************************/
/*                                                                      */
/*  Tab Page Types                                                      */
/*                                                                      */
/*   undefined = Unknown                                                */
/*           0 = Normal Page                                            */
/*           1 = Saved Page                                             */
/*           2 = Saved Page with Resource Loader                        */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Tab Save States                                                     */
/*                                                                      */
/*   undefined = Tab does not exist or URL never committed              */
/*          -2 = URL committed                                          */
/*          -1 = Script loaded                                          */
/*           0 = Lazy Loads                                             */
/*           1 = First Pass                                             */
/*           2 = Second Pass                                            */
/*           3 = Third Pass                                             */
/*           4 = Remove Resource Loader                                 */
/*           5 = Extract Image/Audio/Video                              */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;
var ffVersion;

var platformOS;
var platformArch;

//var printEditId = "";

//var mapActions = new Array(0, 2, 1);

var buttonActionType, buttonActionItems;
var showSubmenu, showSaveAsDialog;
var forceLazyLoads;
var urlListURLs;
var urlListTime;
var maxResourceSize;
var maxResourceTime;
var allowPassive;
var refererHeader;
var useAutomation;

var highlightedCount;

var saveWindowId;
var currentTabId;
var selectedTabIds = new Array();
var listedURLs = new Array();

var tabSaveParams = new Array();

var tabPageTypes = new Array();
var tabSaveStates = new Array();

//var saveStateTexts = new Array("LAZ","SAV","SAV","SAV","REM","EXT","");
//var saveStateColors = new Array("#606060","#E00000","#A000D0","#0000E0","#A06000","#008000","#000000");

var refererKeys = new Array();
var refererValues = new Array();

var originKeys = new Array();
var originValues = new Array();

//var htmlStrings = new Array();

//var cancelSave = false;

/************************************************************************/

/* Initialize on browser startup */

chrome.runtime.getPlatformInfo(
	function (PlatformInfo) {
		platformOS = PlatformInfo.os;

		chrome.storage.local.set({
			"environment-platformos": platformOS
		});

		platformArch = PlatformInfo.arch;

		chrome.storage.local.set({
			"environment-platformarch": platformArch
		});

		//    isFirefox = (navigator.userAgent.indexOf("Firefox") >= 0);
		isFirefox = true;

		chrome.storage.local.set({
			"environment-isfirefox": isFirefox
		});

		chrome.runtime.getBrowserInfo(
			function (info) {
				ffVersion = info.version.substr(0, info.version.indexOf("."));

				chrome.storage.local.set({
					"environment-ffversion": ffVersion
				});

				//				printEditId = "printedit-we@DW-dev";

				initialize();
			});
	});

function initialize() {
	chrome.storage.local.get(null,
		function (object) {
			var contexts = new Array();

			/* Initialize or migrate options */

			/* General options */

			//			if (!("options-buttonactiontype" in object)) object["options-buttonactiontype"] = 0;
			//
			//			if (!("options-buttonaction" in object)) object["options-buttonaction"] =
			//				("options-savebuttonaction" in object) ? object["options-savebuttonaction"] : 2; /* Version 2.0-2.1 */
			//
			//			if (!("options-newbuttonaction" in object)) object["options-newbuttonaction"] =
			//				("options-buttonaction" in object) ? mapActions[object["options-buttonaction"]] : 1; /* Version 3.0-12.8 */
			//
			//			if (!("options-buttonactionitems" in object)) object["options-buttonactionitems"] =
			//				("options-newbuttonaction" in object) ? object["options-newbuttonaction"] : 1; /* Version 13.0-17.3 */
			//
			//			if (!("options-showsubmenu" in object)) object["options-showsubmenu"] =
			//				("options-showmenuitem" in object) ? object["options-showmenuitem"] : true; /* Version 3.0-5.0 */
			//
			//			if (!("options-showwarning" in object)) object["options-showwarning"] = true;
			//
			//			if (!("options-showresources" in object)) object["options-showresources"] =
			//				("options-showurllist" in object) ? object["options-showurllist"] : false; /* Version 7.5-17.3 */
			//
			//			if (!("options-promptcomments" in object)) object["options-promptcomments"] = false;


			//			if (!("options-usenewsavemethod" in object)) object["options-usenewsavemethod"] = false;
			// TODO: WE should always use one or the other - repl a logic switch downstream
			object["options-usenewsavemethod"] = false;


			//			if (!("options-showsaveasdialog" in object)) object["options-showsaveasdialog"] = false;
			object["options-showsaveasdialog"] = false; // TODO replace the logic switch downstream

			//			if (!("options-skipwarningscomments" in object)) object["options-skipwarningscomments"] = true;
			object["options-skipwarningscomments"] = true;

			//			if (!("options-forcelazyloads" in object)) object["options-forcelazyloads"] = false;
			object["options-forcelazyloads"] = true;

			if (!("options-lazyloadstype" in object)) object["options-lazyloadstype"] = "0";

			if (!("options-retaincrossframes" in object)) object["options-retaincrossframes"] = true;

			if (!("options-mergecssimages" in object)) object["options-mergecssimages"] = true;

			if (!("options-executescripts" in object)) object["options-executescripts"] = false;

			if (!("options-removeunsavedurls" in object)) object["options-removeunsavedurls"] = true;

			if (!("options-removeelements" in object)) object["options-removeelements"] =
				("options-purgeelements" in object) ? object["options-purgeelements"] : false; /* Version 13.2-20.1 */

			if (!("options-rehideelements" in object)) object["options-rehideelements"] = false;

			if (!("options-includeinfobar" in object)) object["options-includeinfobar"] =
				("options-includenotification" in object) ? object["options-includenotification"] : false; /* Version 7.4 */

			if (!("options-includesummary" in object)) object["options-includesummary"] = false;

			if (!("options-formathtml" in object)) object["options-formathtml"] = false;

			/* Saved Items options */

			if (!("options-savehtmlimagesall" in object)) object["options-savehtmlimagesall"] =
				("options-saveallhtmlimages" in object) ? object["options-saveallhtmlimages"] : false; /* Version 2.0-3.0 */

			if (!("options-savehtmlaudiovideo" in object)) object["options-savehtmlaudiovideo"] = false;

			if (!("options-savehtmlobjectembed" in object)) object["options-savehtmlobjectembed"] = false;

			if (!("options-savecssimagesall" in object)) object["options-savecssimagesall"] =
				("options-saveallcssimages" in object) ? object["options-saveallcssimages"] : false; /* Version 2.0-3.0 */

			if (!("options-savecssfontswoff" in object)) object["options-savecssfontswoff"] =
				("options-saveallcustomfonts" in object) ? object["options-saveallcustomfonts"] : false; /* Version 2.0-3.0 */

			if (!("options-savecssfontsall" in object)) object["options-savecssfontsall"] = false;

			if (!("options-savescripts" in object)) object["options-savescripts"] =
				("options-saveallscripts" in object) ? object["options-saveallscripts"] : false; /* Version 2.0-3.0 */

			/* File Info options */

			if (!("options-urllisturls" in object)) object["options-urllisturls"] = new Array();

			if (!("options-urllistname" in object)) object["options-urllistname"] = "";

			if (!("options-savedfilename" in object)) object["options-savedfilename"] = "%TITLE%";

			if (!("options-replacespaces" in object)) object["options-replacespaces"] = false;

			if (!("options-replacechar" in object)) object["options-replacechar"] = "-";

			if (!("options-maxfilenamelength" in object)) object["options-maxfilenamelength"] = 150;

			/* Advanced options */

			if (!("options-urllisttime" in object)) object["options-urllisttime"] = 10;

			if (!("options-lazyloadsscrolltime" in object)) object["options-lazyloadsscrolltime"] = 0.2;

			if (!("options-lazyloadsshrinktime" in object)) object["options-lazyloadsshrinktime"] =
				("options-lazyloadstime" in object) ? object["options-lazyloadstime"] : 0.5; /* Version 20.2-23.9 */

			if (!("options-maxframedepth" in object)) object["options-maxframedepth"] =
				("options-saveframedepth" in object) ? object["options-saveframedepth"] : 5; /* Version 2.0-2.1 */

			if (!("options-maxresourcesize" in object)) object["options-maxresourcesize"] = 50;

			if (!("options-maxresourcetime" in object)) object["options-maxresourcetime"] =
				("options-resourcetimeout" in object) ? object["options-resourcetimeout"] : 10; /* Version 9.0-9.1 */

			if (!("options-allowpassive" in object)) object["options-allowpassive"] = false;

			if (!("options-refererheader" in object)) object["options-refererheader"] = 0;

			if (!("options-useautomation" in object)) object["options-useautomation"] = false;

			if (!("options-maxframedepth-9.0" in object)) {
				object["options-maxframedepth"] = 5;
				object["options-maxframedepth-9.0"] = true;
			}

			/* Update stored options */

			chrome.storage.local.set(object);

			/* Initialize local options */

			// TODO: remove controls downstream
			//			buttonActionType = object["options-buttonactiontype"];
			//
			//			buttonActionItems = object["options-buttonactionitems"];
			//
			//			showSubmenu = object["options-showsubmenu"];
			//
			//			showSaveAsDialog = object["options-showsaveasdialog"];

			forceLazyLoads = object["options-forcelazyloads"];

			urlListURLs = object["options-urllisturls"];

			urlListTime = object["options-urllisttime"];

			maxResourceSize = object["options-maxresourcesize"];

			maxResourceTime = object["options-maxresourcetime"];

			allowPassive = object["options-allowpassive"];

			refererHeader = object["options-refererheader"];

			useAutomation = object["options-useautomation"];

			/* Create context menu items */
			// NOTE: all removed

			/* Update browser action and context menus for first tab */
			/* Perform Button Action on browser startup */
			// NOTE: I'm quite sure we don't need to wait for a load here - we'll be triggering savings from other places, when we are sure it's all loaded
			//			chrome.tabs.query({
			//					lastFocusedWindow: true,
			//					active: true
			//				},
			//				function (tabs) {
			//					/* Initialize states for first tab */
			//
			//					if (!specialPage(tabs[0].url)) {
			//						chrome.tabs.executeScript(tabs[0].id, {
			//								code: "(document.querySelector(\"script[id='savepage-pageloader']\") != null || " + /* Version 7.0-14.0 */
			//									" document.querySelector(\"meta[name='savepage-resourceloader']\") != null) ? 2 : " + /* Version 15.0 - 15.1 */
			//									" document.querySelector(\"meta[name='savepage-url']\") != null ? 1 : 0",
			//								frameId: 0
			//							},
			//							function (pagetype) {
			//								tabPageTypes[tabs[0].id] = pagetype;
			//								tabSaveStates[tabs[0].id] = -2;
			//
			//								updateBrowserAction(tabs[0].id, tabs[0].url);
			//
			//								updateContextMenus();
			//							});
			//					} else /* special page */ {
			//						tabPageTypes[tabs[0].id] = 0;
			//						tabSaveStates[tabs[0].id] = -2;
			//
			//						updateBrowserAction(tabs[0].id, tabs[0].url);
			//
			//						updateContextMenus();
			//					}
			//
			//					/* Automatic save on startup */ // NOTE: we won't have it
			//				});

			/* Add listeners */

			addListeners();
		});
}

/************************************************************************/

/* Add listeners */

function addListeners() {
	/* Storage changed listener */ // We don't have menus/pages for changing any of these ==> remove these listeners

//	chrome.storage.onChanged.addListener(
//		function (changes, areaName) {
//			var contexts = new Array();
//
//			//			if ("options-buttonactiontype" in changes) buttonActionType = changes["options-buttonactiontype"].newValue;
//			//
//			//			if ("options-buttonactionitems" in changes) buttonActionItems = changes["options-buttonactionitems"].newValue;
//			//
//			//			if ("options-showsubmenu" in changes) showSubmenu = changes["options-showsubmenu"].newValue;
//			//
//			//			if ("options-showsaveasdialog" in changes) showSaveAsDialog = changes["options-showsaveasdialog"].newValue;
//			//
//			//			if ("options-forcelazyloads" in changes) forceLazyLoads = changes["options-forcelazyloads"].newValue;
//
//			if ("options-urllisturls" in changes) urlListURLs = changes["options-urllisturls"].newValue;
//
//			if ("options-urllisttime" in changes) urlListTime = changes["options-urllisttime"].newValue;
//
//			//			if ("options-maxresourcesize" in changes) maxResourceSize = changes["options-maxresourcesize"].newValue;
//			//
//			//			if ("options-maxresourcetime" in changes) maxResourceTime = changes["options-maxresourcetime"].newValue;
//			//
//			//			if ("options-allowpassive" in changes) allowPassive = changes["options-allowpassive"].newValue;
//
//			if ("options-refererheader" in changes) refererHeader = changes["options-refererheader"].newValue;
//
//			//			if ("options-useautomation" in changes) useAutomation = changes["options-useautomation"].newValue;
//			//
//			//			if ("options-buttonactiontype" in changes || "options-showsubmenu" in changes || "options-urllisturls" in changes) {
//			//				chrome.tabs.query({
//			//						lastFocusedWindow: true,
//			//						active: true
//			//					},
//			//					function (tabs) {
//			//						updateBrowserAction(tabs[0].id, tabs[0].url);
//			//
//			//						updateContextMenus();
//			//					});
//			//			}
//		});

	/* Browser action listener */

	// NOTE: disabled, but we may use: initiateAction(buttonActionType, buttonActionItems, null, false, false);

	//	chrome.browserAction.onClicked.addListener(
	//		function (tab) {
	//			initiateAction(buttonActionType, buttonActionItems, null, false, false);
	//		});

	/* Keyboard command listener */

	// NOTE: we wont' have commands ==> remove
	//	chrome.commands.onCommand.addListener(
	//		function (command) {
	//			if (command == "cancelsave") {
	//				cancelAction();
	//			}
	//		});

	/* Context menu listener */ // NOTE: removed

	// TODO: use this to initiate a save: // initiateAction(0, 1, null, false, false);

	//	chrome.contextMenus.onClicked.addListener(
	//		function (info, tab) {
	//			if (info.menuItemId == "saveselectedtabs-basicitems") initiateAction(0, 0, null, false, false);
	//			else if (info.menuItemId == "saveselectedtabs-standarditems") initiateAction(0, 1, null, false, false);
	//			else if (info.menuItemId == "saveselectedtabs-customitems") initiateAction(0, 2, null, false, false);
	//			else if (info.menuItemId == "savelistedurls-basicitems") initiateAction(1, 0, null, false, false);
	//			else if (info.menuItemId == "savelistedurls-standarditems") initiateAction(1, 1, null, false, false);
	//			else if (info.menuItemId == "savelistedurls-customitems") initiateAction(1, 2, null, false, false);
	//			else if (info.menuItemId == "cancelsave") cancelAction();
	//			else if (info.menuItemId == "viewpageinfo") initiateAction(2, null, null, false, false);
	//			else if (info.menuItemId == "removeresourceloader") initiateAction(3, null, null, false, false);
	//			else if (info.menuItemId == "extractmedia") initiateAction(4, null, info.srcUrl, false, false);
	//		});

	/* Tab event listeners */

	//	chrome.tabs.onActivated.addListener( /* tab selected */
	//		function (activeInfo) {
	//			chrome.tabs.get(activeInfo.tabId,
	//				function (tab) {
	//					if (chrome.runtime.lastError == null) /* sometimes tab does not exist */ {
	//						updateBrowserAction(tab.id, tab.url);
	//
	//						updateContextMenus();
	//					}
	//				});
	//		});

	//	chrome.tabs.onHighlighted.addListener( /* tab highlighted */
	//		function (highlightInfo) {
	//			chrome.tabs.query({
	//					lastFocusedWindow: true,
	//					active: true
	//				},
	//				function (tabs) {
	//					highlightedCount = highlightInfo.tabIds.length;
	//
	//					updateBrowserAction(tabs[0].id, tabs[0].url);
	//
	//					updateContextMenus();
	//				});
	//		});
	//
	//	chrome.tabs.onUpdated.addListener( /* URL updated */
	//		function (tabId, changeInfo, tab) {
	//			updateBrowserAction(tab.id, tab.url);
	//
	//			updateContextMenus();
	//		});

	/* Web navigation listeners */

	// TODO: do I need this one?...
	chrome.webNavigation.onCommitted.addListener(
		function (details) {
			if (details.frameId === 0) {
				tabPageTypes[details.tabId] = 0;
				tabSaveStates[details.tabId] = -2;

				//				updateBrowserAction(details.tabId, details.url);
				//
				//				updateContextMenus();
			}
		});

	//	chrome.webNavigation.onCompleted.addListener( /* page loaded or (Firefox) extracted resource downloaded */
	//		function (details) {
	//			/* Firefox - listener called as if page load when download popup window opens - see Bug 1441474 */
	//
	//			chrome.tabs.get(details.tabId,
	//				function (tab) {
	//					if (details.frameId == 0 && details.url != tab.url) return; /* Firefox - workaround for when download popup window opens */
	//
	//					if (details.frameId == 0) {
	//						if (!specialPage(details.url)) {
	//							chrome.tabs.executeScript(details.tabId, {
	//									code: "(document.querySelector(\"script[id='savepage-pageloader']\") != null || " + /* Version 7.0-14.0 */
	//										" document.querySelector(\"meta[name='savepage-resourceloader']\") != null) ? 2 : " + /* Version 15.0 - 15.1 */
	//										" document.querySelector(\"meta[name='savepage-url']\") != null ? 1 : 0",
	//									frameId: 0
	//								},
	//								function (pagetype) {
	//									tabPageTypes[details.tabId] = pagetype;
	//									tabSaveStates[details.tabId] = -2;
	//
	//									updateBrowserAction(details.tabId, details.url);
	//
	//									updateContextMenus();
	//								});
	//						} else /* special page */ {
	//							tabPageTypes[details.tabId] = 0;
	//							tabSaveStates[details.tabId] = -2;
	//
	//							updateBrowserAction(details.tabId, details.url);
	//
	//							updateContextMenus();
	//						}
	//					}
	//				});
	//		});

	/* Web request listeners */

	chrome.webRequest.onBeforeSendHeaders.addListener(
		function (details) {
			var i, j;

			for (i = 0; i < details.requestHeaders.length; i++) {
				if (details.requestHeaders[i].name === "savepage-referer") {
					for (j = 0; j < refererKeys.length; j++) {
						if (details.requestHeaders[i].value === refererKeys[j]) {
							details.requestHeaders.splice(i, 1, {
								name: "Referer",
								value: refererValues[j]
							});
						}
					}
				}

				if (details.requestHeaders[i].name === "savepage-origin") {
					for (j = 0; j < originKeys.length; j++) {
						if (details.requestHeaders[i].value === originKeys[j]) {
							details.requestHeaders.splice(i, 1, {
								name: "Origin",
								value: originValues[j]
							});
						}
					}
				}
			}

			return {
				requestHeaders: details.requestHeaders
			};
		}, {
			urls: ["<all_urls>"],
			types: ["xmlhttprequest"]
		}, ["blocking", "requestHeaders"]);

	/* Message received listener */

	chrome.runtime.onMessage.addListener(
		function (message, sender, sendResponse) {
			var safeContent, mixedContent, refererURL, refererKey, originKey, htmlBlob, objectURL, receiverId;
			var xhr = {}; //new Object();

			switch (message.type) {
				/* Messages from content script */

				case "delay": // NOTE: we'll keep this, but it's a bit pointless

					window.setTimeout(function () {
						sendResponse();
					}, message.milliseconds);

					return true; /* asynchronous response */

				case "scriptLoaded": // NOTE: I hope it's called from a content script...
					console.log("scriptLoaded received in our HTML saver");
					tabSaveStates[sender.tab.id] = -1;

					//					updateBrowserAction(sender.tab.id, sender.tab.url);
					//
					//					updateContextMenus();

					chrome.tabs.sendMessage(sender.tab.id, {
						type: "performAction",
						menuaction: tabSaveParams[sender.tab.id].menuaction,
						saveditems: tabSaveParams[sender.tab.id].saveditems,
						extractsrcurl: tabSaveParams[sender.tab.id].extractsrcurl,
						multiplesaves: tabSaveParams[sender.tab.id].multiplesaves,
						externalsave: tabSaveParams[sender.tab.id].externalsave,
						swapdevices: tabSaveParams[sender.tab.id].swapdevices
					}, checkError);

					break;

					//				case "setPageType":
					//
					//					tabPageTypes[sender.tab.id] = message.pagetype;
					//
					////					updateBrowserAction(sender.tab.id, sender.tab.url);
					////
					////					updateContextMenus();
					//
					//					break;

				case "setSaveState":

					tabSaveStates[sender.tab.id] = message.savestate;

					//					updateBrowserAction(sender.tab.id, sender.tab.url);
					//
					//					updateContextMenus();

					break;

				case "requestFrames":

					chrome.tabs.sendMessage(sender.tab.id, {
						type: "requestFrames"
					}, checkError);

					break;

				case "replyFrame":

					chrome.tabs.sendMessage(sender.tab.id, {
						type: "replyFrame",
						key: message.key,
						url: message.url,
						html: message.html,
						fonts: message.fonts
					}, checkError);

					break;

				case "loadResource":

					/* XMLHttpRequest must not be sent if http: resource in https: page or https: referer */
					/* unless passive mixed content allowed by user option */

					safeContent = (message.location.substr(0, 6) == "https:" ||
						(message.location.substr(0, 5) == "http:" && message.referer.substr(0, 5) == "http:" && message.pagescheme == "http:"));

					mixedContent = (message.location.substr(0, 5) == "http:" && (message.referer.substr(0, 6) == "https:" || message.pagescheme == "https:"));

					if (safeContent || (mixedContent && message.passive && allowPassive)) {
						/* Load same-origin resource - or cross-origin with or without CORS - and add Referer Header */

						try {
							xhr = new XMLHttpRequest();

							xhr.open("GET", message.location, true);

							refererURL = new URL(message.referer);

							/* Referer Header must not be set if http: resource in https: page or https: referer */
							/* Referer Header must not be set if file: or data: resource */
							/* Referer Header only set if allowed by user option */
							/* Referer Header has restricted referer URL */

							if (safeContent && message.referer.substr(0, 5) != "file:" && message.referer.substr(0, 5) != "data:") {
								if (refererHeader > 0) {
									refererKey = Math.trunc(Math.random() * 1000000000);

									refererKeys.push(refererKey);

									if (refererHeader == 1) refererValues.push(refererURL.origin); /* referer URL restricted to origin */
									else if (refererHeader == 2) {
										if (sender.tab.incognito) refererValues.push(refererURL.origin); /* referer URL restricted to origin */
										else refererValues.push(refererURL.origin + refererURL.pathname); /* referer URL restricted to origin and path */
									}

									xhr.setRequestHeader("savepage-referer", refererKey);

									xhr._refererkey = refererKey;
								}
							}

							/* Origin Header must be set for CORS to operate */

							if (message.usecors) {
								originKey = Math.trunc(Math.random() * 1000000000);

								originKeys.push(originKey);

								originValues.push(refererURL.origin);

								xhr.setRequestHeader("savepage-origin", originKey);

								xhr._originkey = originKey;
							}

							xhr.setRequestHeader("Cache-Control", "no-store");

							xhr.responseType = "arraybuffer";
							xhr.timeout = maxResourceTime * 1000;
							xhr.onload = onloadResource;
							xhr.onerror = onerrorResource;
							xhr.ontimeout = ontimeoutResource;
							xhr.onprogress = onprogressResource;

							xhr._tabId = sender.tab.id;
							xhr._index = message.index;

							xhr.send(); /* throws exception if url is invalid */
						} catch (e) {
							if (xhr._refererkey) removeRefererKey(xhr._refererkey);
							if (xhr._originkey) removeOriginKey(xhr._originkey);

							chrome.tabs.sendMessage(sender.tab.id, {
								type: "loadFailure",
								index: message.index,
								reason: "send"
							}, checkError);
						}
					} else chrome.tabs.sendMessage(sender.tab.id, {
						type: "loadFailure",
						index: message.index,
						reason: "mixed"
					}, checkError);

					function onloadResource() {
						var i, binaryString, contentType, allowOrigin;
						var byteArray = new Uint8Array(this.response);

						if (this._refererkey) removeRefererKey(this._refererkey);
						if (this._originkey) removeOriginKey(this._originkey);

						if (this.status == 200) {
							binaryString = "";
							for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);

							contentType = this.getResponseHeader("Content-Type");
							if (contentType == null) contentType = "";

							allowOrigin = this.getResponseHeader("Access-Control-Allow-Origin");
							if (allowOrigin == null) allowOrigin = "";

							chrome.tabs.sendMessage(this._tabId, {
								type: "loadSuccess",
								index: this._index,
								content: binaryString,
								contenttype: contentType,
								alloworigin: allowOrigin
							}, checkError);
						} else chrome.tabs.sendMessage(this._tabId, {
							type: "loadFailure",
							index: this._index,
							reason: "load:" + this.status
						}, checkError);
					}

					function onerrorResource() {
						if (this._refererkey) removeRefererKey(this._refererkey);
						if (this._originkey) removeOriginKey(this._originkey);

						chrome.tabs.sendMessage(this._tabId, {
							type: "loadFailure",
							index: this._index,
							reason: "network"
						}, checkError);
					}

					function ontimeoutResource() {
						if (this._refererkey) removeRefererKey(this._refererkey);
						if (this._originkey) removeOriginKey(this._originkey);

						chrome.tabs.sendMessage(this._tabId, {
							type: "loadFailure",
							index: this._index,
							reason: "maxtime"
						}, checkError);
					}

					function onprogressResource(event) {
						if (event.lengthComputable && event.total > maxResourceSize * 1024 * 1024) {
							this.abort();

							chrome.tabs.sendMessage(this._tabId, {
								type: "loadFailure",
								index: this._index,
								reason: "maxsize"
							}, checkError);
						}
					}

					function removeRefererKey(refererkey) {
						var j;

						for (j = 0; j < refererKeys.length; j++) {
							if (refererKeys[j] == refererkey) {
								refererKeys.splice(j, 1);
								refererValues.splice(j, 1);
							}
						}
					}

					function removeOriginKey(originkey) {
						var j;

						for (j = 0; j < originKeys.length; j++) {
							if (originKeys[j] == originkey) {
								originKeys.splice(j, 1);
								originValues.splice(j, 1);
							}
						}
					}

					break;

					//				case "selectTab":
					//
					//					chrome.tabs.update(sender.tab.id, {
					//						active: true
					//					});
					//
					//					break;

					//				case "saveExit": // TODO: do we actually need it?
					//
					//					tabSaveStates[sender.tab.id] = -1;
					//
					////					updateBrowserAction(sender.tab.id, sender.tab.url);
					////
					////					updateContextMenus();
					//
					//					finishAction(sender.tab.id, false);
					//
					//					break;

				case "waitBeforeRevoke":

					window.setTimeout(
						function (tabId) {
							chrome.tabs.sendMessage(tabId, {
								type: "nowRevokeObject"
							}, checkError);
						}, 100, sender.tab.id);

					break;

					//				case "saveDone":
					//
					//					tabSaveStates[sender.tab.id] = -1;
					//
					////					updateBrowserAction(sender.tab.id, sender.tab.url);
					////
					////					updateContextMenus();
					//
					//					finishAction(sender.tab.id, true);
					//
					//					break;

					//				case "transferString": // TODO: transfer from where?... <== We don't need it - it's only used with the new Save Method, which we set to false // NEW note: we do use it to transfer all strings to stitch up together

					//					if (message.htmlindex == 0) htmlStrings.length = 0;
					//
					//					htmlStrings[message.htmlindex] = message.htmlstring;
					//
					//					break;

					//				case "savePage":
					// TODO implement data transfer
					// then call downloadDone(true)


					/* Convert HTML strings to HTML blob */

					//					htmlBlob = new Blob(htmlStrings, {
					//						type: "text/html"
					//					});
					//
					//					objectURL = window.URL.createObjectURL(htmlBlob);
					//
					//					htmlBlob = null;
					//
					//					htmlStrings.length = 0;
					//
					//					/* Download HTML blob as .html file */
					//
					//					chrome.downloads.onChanged.addListener(onChangedCallback);
					//
					//					function onChangedCallback(downloadDelta) {
					//						if (downloadDelta.error && downloadDelta.error.current == "USER_CANCELED") /* Chrome */ {
					//							downloadDone(false);
					//						} else if (downloadDelta.state && downloadDelta.state.current == "interrupted") {
					//							alertNotify("Saving of page was interrupted:\n > " + sender.tab.title);
					//
					//							downloadDone(false);
					//						} else if (downloadDelta.state && downloadDelta.state.current == "complete") {
					//							downloadDone(true);
					//						}
					//					}
					//
					//					if (isFirefox && ffVersion >= 57) {
					//						chrome.downloads.download({
					//								url: objectURL,
					//								filename: message.filename,
					//								saveAs: showSaveAsDialog ? true : null,
					//								incognito: sender.tab.incognito
					//							},
					//							function (downloadItemId) {
					//								if (chrome.runtime.lastError != null && chrome.runtime.lastError.message == "Download canceled by the user") /* Firefox */ {
					//									downloadDone(false);
					//								}
					//							});
					//					} else chrome.downloads.download({
					//						url: objectURL,
					//						filename: message.filename,
					//						saveAs: showSaveAsDialog ? true : null
					//					});

					//					function downloadDone(success) {
					////						chrome.downloads.onChanged.removeListener(onChangedCallback);
					//
					//						window.URL.revokeObjectURL(objectURL);
					//
					//						tabSaveStates[sender.tab.id] = -1;
					//
					////						updateBrowserAction(sender.tab.id, sender.tab.url);
					////
					////						updateContextMenus();
					//
					//						finishAction(sender.tab.id, success);
					//					}

					//					break;
			}
		});

	/* External message received listener */

	// NOTE: I hope it's not needed, I suspect "externalSaveStart" is for smth not essential for the core saving process

	//	if (!isFirefox || ffVersion >= 54) {
	//		chrome.runtime.onMessageExternal.addListener(
	//			function (message, sender, sendResponse) {
	//				switch (message.type) {
	//					/* Messages from another add-on */
	//
	//					case "externalSaveStart":
	//
	//						if (sender.id == printEditId) {
	//							sendResponse({});
	//
	//							if (message.action <= 2) /* saved items */ {
	//								chrome.tabs.query({
	//										lastFocusedWindow: true,
	//										active: true
	//									},
	//									function (tabs) {
	//										initiateAction(0, message.action, null, true, message.swapdevices);
	//									});
	//							} else {
	//								chrome.runtime.sendMessage(printEditId, {
	//									type: "externalSaveDone",
	//									tabid: sender.tab.id,
	//									success: false
	//								}, checkError);
	//							}
	//						}
	//
	//						break;
	//
	//					case "externalSaveCheck":
	//
	//						if (sender.id == printEditId) {
	//							sendResponse({});
	//						}
	//
	//						break;
	//				}
	//			});
	//	}
}

/************************************************************************/

/* Initiate/Next/Perform/Finish/Cancel action functions */

window._initSaveHtml = function (tabId) {
	//	initiateAction(0, buttonActionItems, null, false, false);
	tabSaveParams[tabId] = {};

	tabSaveParams[tabId].menuaction = 0;
	tabSaveParams[tabId].saveditems = 1; // 1 is for a strandard all-item save
	tabSaveParams[tabId].extractsrcurl = null;
	tabSaveParams[tabId].multiplesaves = false;
	tabSaveParams[tabId].externalsave = false;
	tabSaveParams[tabId].swapdevices = false;

	chrome.tabs.executeScript(tabId, {
		file: "/client/htmlSaverScripts/content.js"
	});
	chrome.tabs.executeScript(tabId, {
		file: "/client/htmlSaverScripts/content-frame.js",
		allFrames: true
	});

	const htmlStrings = [];

	// Note: we'll accumulate string here - cause we want to do it for multiple tabs
	const transferStrHandler = (message, sender, sendResponse) => {
		if (message.type === "transferString" && sender.tab.id === tabId) {
			htmlStrings[message.htmlindex] = message.htmlstring;
		}
	};
	chrome.runtime.onMessage.addListener(transferStrHandler);

	return new Promise(function (resolve, reject) {
		// Given so many potential point of failure, let's just presume it's all failed after a minute of waiting
		var failed = true;
		setTimeout(function () {
			if (failed) {
				reject();
			}
		}, 60000);
		const handler = (message, sender, sendResponse) => {
			if (message.type === "savePage" && sender.tab.id === tabId) {
				failed = false;
				chrome.runtime.onMessage.removeListener(handler);
				chrome.runtime.onMessage.removeListener(transferStrHandler);
				resolve(htmlStrings);
			}
		};
		chrome.runtime.onMessage.addListener(handler);
	});
	// Note on workflow:
	// We call this F when all else is done on the page
	// It replies with ScriptLoaded when it's ready; The Bg script forwards options to the content script
};

//window.initiateAction = function(menuaction, saveditems, extractsrcurl, externalsave, swapdevices) {
//	nextAction(menuaction, saveditems, extractsrcurl, false, externalsave, swapdevices);	
//};


//function initiateAction(menuaction, saveditems, extractsrcurl, externalsave, swapdevices) {
//	chrome.windows.getLastFocused({},
//		function (win) {
//			saveWindowId = win.id;
//
//			chrome.tabs.query({
//					windowId: win.id
//				},
//				function (tabs) {
//					var i;
//
//					if (menuaction == 0) {
//						selectedTabIds.length = 0;
//
//						for (i = 0; i < tabs.length; i++) {
//							if (tabs[i].highlighted || tabs[i].active || useAutomation) selectedTabIds.push(tabs[i].id); /* Opera doesn't support highlighted - so check active */
//						}
//
//						nextAction(menuaction, saveditems, extractsrcurl, (selectedTabIds.length > 1), externalsave, swapdevices);
//					} else if (menuaction == 1) {
//						listedURLs.length = 0;
//
//						for (i = 0; i < urlListURLs.length; i++) {
//							listedURLs.push(urlListURLs[i]);
//						}
//
//						nextAction(menuaction, saveditems, extractsrcurl, true, externalsave, swapdevices);
//					} else {
//						selectedTabIds.length = 0;
//
//						for (i = 0; i < tabs.length; i++) {
//							if (tabs[i].active) selectedTabIds.push(tabs[i].id);
//						}
//
//						nextAction(menuaction, saveditems, extractsrcurl, false, externalsave, swapdevices);
//					}
//
//					for (i = 0; i < tabs.length; i++) {
//						if (tabs[i].highlighted && !tabs[i].active) chrome.tabs.update(tabs[i].id, {
//							highlighted: false
//						});
//					}
//				});
//		});
//}

//function nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices) {
//	var tabId, url, timeout;
//
//	if (menuaction == 0) {
//		if (selectedTabIds.length > 0) {
//			currentTabId = selectedTabIds.shift();
//
//			chrome.tabs.update(currentTabId, {
//					active: forceLazyLoads
//				},
//				function (tab) {
//					performAction(currentTabId, menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//				});
//		} else if (useAutomation) {
//			chrome.windows.getLastFocused({},
//				function (win) {
//					chrome.windows.remove(win.id);
//				});
//		}
//	} else if (menuaction == 1) {
//		if (listedURLs.length > 0) {
//			url = listedURLs.shift();
//
//			chrome.tabs.create({
//					windowId: saveWindowId,
//					url: url,
//					active: forceLazyLoads
//				},
//				function (tab) {
//					currentTabId = tab.id;
//
//					chrome.tabs.onUpdated.addListener(listener);
//				});
//
//			timeout = window.setTimeout(
//				function () {
//					chrome.tabs.onUpdated.removeListener(listener);
//
//					chrome.tabs.remove(currentTabId);
//
//					nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//				}, urlListTime * 1000);
//
//			function listener(tabId, changeInfo, tab) {
//				if (tab.id == currentTabId && tab.status == "complete") {
//					window.clearTimeout(timeout);
//					chrome.tabs.onUpdated.removeListener(listener);
//
//					performAction(currentTabId, menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//				}
//			}
//		} else if (useAutomation) {
//			chrome.windows.getLastFocused({},
//				function (win) {
//					chrome.windows.remove(win.id);
//				});
//		}
//	} else {
//		if (selectedTabIds.length > 0) {
//			currentTabId = selectedTabIds.shift();
//
//			performAction(currentTabId, menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//		}
//	}
//}

//function performAction(tabId, menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices) {
//	chrome.tabs.get(tabId,
//		function (tab) {
//			if (specialPage(tab.url)) {
//				alertNotify("Cannot be used with this page:\n > " + tab.title);
//
//				nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//			} else if (tab.status != "complete") {
//				alertNotify("Page is not ready:\n > " + tab.title);
//
//				nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//			} else if (menuaction >= 2 && (typeof tabPageTypes[tab.id] == "undefined" || tabPageTypes[tab.id] == 0)) /* not saved page */ {
//				alertNotify("Page is not a saved page:\n > " + tab.title);
//
//				nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//			} else {
//				if (typeof tabSaveStates[tab.id] == "undefined" || tabSaveStates[tab.id] <= -2) /* script not loaded */ {
//					tabSaveParams[tab.id] = new Object();
//
//					tabSaveParams[tab.id].menuaction = menuaction;
//					tabSaveParams[tab.id].saveditems = saveditems;
//					tabSaveParams[tab.id].extractsrcurl = extractsrcurl;
//					tabSaveParams[tab.id].multiplesaves = multiplesaves;
//					tabSaveParams[tab.id].externalsave = externalsave;
//					tabSaveParams[tab.id].swapdevices = swapdevices;
//
//					chrome.tabs.executeScript(tab.id, {
//						file: "content.js"
//					});
//					chrome.tabs.executeScript(tab.id, {
//						file: "content-frame.js",
//						allFrames: true
//					});
//				} else if (tabSaveStates[tab.id] == -1) /* script loaded */ {
//					chrome.tabs.sendMessage(tab.id, {
//						type: "performAction",
//						menuaction: menuaction,
//						saveditems: saveditems,
//						extractsrcurl: extractsrcurl,
//						multiplesaves: multiplesaves,
//						externalsave: externalsave,
//						swapdevices: swapdevices
//					}, checkError);
//				} else if (tabSaveStates[tab.id] >= 0 && tabSaveStates[tab.id] <= 4) /* operation in progress */ {
//					alertNotify("Operation already in progress:\n > " + tab.title);
//
//					nextAction(menuaction, saveditems, extractsrcurl, multiplesaves, externalsave, swapdevices);
//				}
//			}
//		});
//}

//function finishAction(tabId, success) {
////	if (tabSaveParams[tabId].externalsave) {
////		if (!isFirefox || ffVersion >= 54) {
////			chrome.runtime.sendMessage(printEditId, {
////				type: "externalSaveDone",
////				tabid: tabId,
////				success: success
////			}, checkError);
////		}
////	}
//
//	if (tabSaveParams[tabId].menuaction == 1) {
//		chrome.tabs.remove(currentTabId);
//	}
//
//	if (cancelSave) {
//		cancelSave = false;
//	} else {
//		nextAction(tabSaveParams[tabId].menuaction, tabSaveParams[tabId].saveditems, tabSaveParams[tabId].extractsrcurl,
//			tabSaveParams[tabId].multiplesaves, tabSaveParams[tabId].externalsave, tabSaveParams[tabId].swapdevices);
//	}
//}

//function cancelAction() {
//	cancelSave = true;
//
//	chrome.tabs.sendMessage(currentTabId, {
//		type: "cancelSave"
//	}, checkError);
//}

/************************************************************************/

///* Special page function */
//
//function specialPage(url) {
//	return (url.substr(0, 6) == "about:" || url.substr(0, 7) == "chrome:" || url.substr(0, 12) == "view-source:" ||
//		url.substr(0, 14) == "moz-extension:" || url.substr(0, 26) == "https://addons.mozilla.org" || url.substr(0, 27) == "https://support.mozilla.org" ||
//		url.substr(0, 17) == "chrome-extension:" || url.substr(0, 34) == "https://chrome.google.com/webstore");
//}

/************************************************************************/

/* Update browser action function */

//function updateBrowserAction(tabId, url) {
//	/* Cannot catch errors in chrome.browserAction functions in cases where tabs have closed */
//	/* Workaround is to delay and then make sure tab exists before calling these functions */
//
//	window.setTimeout(
//		function () {
//			chrome.tabs.get(tabId,
//				function (tab) {
//					var pagetype, savestate;
//
//					if (chrome.runtime.lastError == null && typeof tab != "undefined" && tab.url != "about:blank") /* tab not closed or about:blank */ {
//						if ((buttonActionType == 0 && (highlightedCount > 1 || (!specialPage(url) && tab.status == "complete"))) || buttonActionType == 1) {
//							chrome.browserAction.enable(tabId);
//
//							if (!isFirefox || ffVersion <= 54) chrome.browserAction.setIcon({
//								tabId: tabId,
//								path: "icon16.png"
//							}); /* Chrome or Firefox 54- - icon not changed */
//						} else {
//							chrome.browserAction.disable(tabId);
//
//							if (!isFirefox || ffVersion <= 54) chrome.browserAction.setIcon({
//								tabId: tabId,
//								path: "icon16-disabled.png"
//							}); /* Chrome or Firefox 54- - icon not changed */
//						}
//
//						pagetype = (typeof tabPageTypes[tabId] == "undefined") ? 0 : tabPageTypes[tabId];
//
//						if (tab.status != "complete") chrome.browserAction.setTitle({
//							tabId: tabId,
//							title: "Save Page WE - page is not ready"
//						});
//						else if (specialPage(url)) chrome.browserAction.setTitle({
//							tabId: tabId,
//							title: "Save Page WE - cannot be used with this page"
//						});
//						else if (pagetype == 0) chrome.browserAction.setTitle({
//							tabId: tabId,
//							title: "Save Page WE - normal page"
//						});
//						else if (pagetype == 1) chrome.browserAction.setTitle({
//							tabId: tabId,
//							title: "Save Page WE - saved page"
//						});
//						else if (pagetype == 2) chrome.browserAction.setTitle({
//							tabId: tabId,
//							title: "Save Page WE - saved page with resource loader"
//						});
//
//						savestate = (typeof tabSaveStates[tabId] == "undefined" || tabSaveStates[tabId] <= -1) ? 6 : tabSaveStates[tabId];
//
//						chrome.browserAction.setBadgeText({
//							tabId: tabId,
//							text: saveStateTexts[savestate]
//						});
//						chrome.browserAction.setBadgeBackgroundColor({
//							tabId: tabId,
//							color: saveStateColors[savestate]
//						});
//					}
//				});
//		}, 10);
//}

/************************************************************************/

/* Update context menus function */

//function updateContextMenus() {
//	chrome.tabs.query({
//			lastFocusedWindow: true,
//			active: true
//		},
//		function (tabs) {
//			var pagetype, savestate, loaded, enable;
//			var contexts = new Array();
//
//			if (chrome.runtime.lastError == null && typeof tabs[0] != "undefined" && tabs[0].url != "about:blank") /* tab not closed or about:blank */ {
//				contexts = showSubmenu ? ["all"] : ["browser_action"];
//				pagetype = (typeof tabPageTypes[tabs[0].id] == "undefined") ? 0 : tabPageTypes[tabs[0].id];
//				savestate = (typeof tabSaveStates[tabs[0].id] == "undefined") ? 6 : tabSaveStates[tabs[0].id];
//				loaded = (tabs[0].status == "complete");
//				enable = (highlightedCount > 1 || (!specialPage(tabs[0].url) && loaded));
//
//				chrome.contextMenus.update("saveselectedtabs", {
//					contexts: contexts,
//					enabled: (pagetype <= 1 && enable)
//				});
//
//				chrome.contextMenus.update("savelistedurls", {
//					contexts: contexts,
//					enabled: (urlListURLs.length > 0)
//				});
//
//				chrome.contextMenus.update("viewpageinfo", {
//					contexts: contexts,
//					enabled: (pagetype >= 1 && loaded)
//				});
//
//				chrome.contextMenus.update("removeresourceloader", {
//					contexts: (pagetype == 2) ? contexts : ["page_action"],
//					enabled: (pagetype == 2 && loaded)
//				});
//
//				chrome.contextMenus.update("extractmedia", {
//					contexts: (pagetype >= 1) ? ["image", "audio", "video"] : ["page_action"],
//					enabled: (pagetype >= 1 && loaded)
//				});
//
//				chrome.contextMenus.update("cancelsave", {
//					contexts: contexts,
//					enabled: (savestate >= 0 && savestate <= 3)
//				});
//			}
//		});
//}

/************************************************************************/

/* Check for sendMessage errors */

function checkError() {
	if (chrome.runtime.lastError == null);
	else if (chrome.runtime.lastError.message == "Could not establish connection. Receiving end does not exist."); /* Chrome & Firefox - ignore */
	else if (chrome.runtime.lastError.message == "The message port closed before a response was received."); /* Chrome - ignore */
	else if (chrome.runtime.lastError.message == "Message manager disconnected"); /* Firefox - ignore */
	else console.log("Save Page WE - " + chrome.runtime.lastError.message);
}

/************************************************************************/

///* Display alert notification */
//
//function alertNotify(message) {
//	chrome.notifications.create("alert", {
//		type: "basic",
//		iconUrl: "icon32.png",
//		title: "SAVE PAGE WE",
//		message: "" + message
//	});
//}
//
///************************************************************************/
//
///* Display debug notification */
//
//function debugNotify(message) {
//	chrome.notifications.create("debug", {
//		type: "basic",
//		iconUrl: "icon32.png",
//		title: "SAVE PAGE WE - DEBUG",
//		message: "" + message
//	});
//}

/************************************************************************/
