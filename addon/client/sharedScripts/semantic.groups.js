/*eslint-env browser*/

(function(){
	const FULL_SCREEN_WIDTH_TOLERANCE = 0.1; // if an element is 90% of the 'root' element width, we count it as full-screen-width
	const MAX_TITLE_LENGTH_CHAR = 125;
	const MAX_LOGO_TEXT_LENGTH = 50; // characters -- chosen on a hunch
	const MAX_MENU_ITEM_TXT_LENGTH = 28; // characters
	const MAX_HEADER_TXT_LENGTH = MAX_MENU_ITEM_TXT_LENGTH * 18; // I doubt there can be more than that, also cause many menu items are much shorter than 25 chars
	const MAX_FOOTER_TXT_LENGTH = MAX_HEADER_TXT_LENGTH * 1.5; // 1.5 times headers -- cause all the small print legal info etc.
	const MAX_TITLE_NUMBER2CHAR_RATIO = 0.1; // 10%
	const MAX_CONTAINER_TITLE_WIDTH_MISMATCH = 0.1; // a title should occupy all of of parent's width, but we allow for 10% fuzziness
	const MAX_HEADER_BOTTOM_COORD = Math.max(255, Math.min(window.innerWidth, window.innerHeight) * 0.25); // window.window.getScrlEl().scrollWidth * 0.25; // quite arbitrary; we presume headers' height should scale with the window
	const MAX_FOOTER_TOP_COORD = ()=> window.getScrlEl().scrollHeight - Math.max(window.getScrlEl().scrollHeight * 0.2, MAX_HEADER_BOTTOM_COORD); // because scrollHeight may change after document fully (async) loaded - and scripts are run before that
	const MAX_HEADER_CANDIDATE_BOTTOM_COORD = MAX_HEADER_BOTTOM_COORD * 2;
	const MAX_FOOTER_CANDIDATE_TOP_COORD = ()=> window.getScrlEl().scrollHeight - Math.max(window.getScrlEl().scrollHeight * 0.2, MAX_HEADER_BOTTOM_COORD) * 2;
	
	// const MIN_HEADER_HEIGHT = MAX_HEADER_BOTTOM_COORD * 0.5;
	
	const MAX_SOCIAL_BUTTON_WIDTH = Math.max(window.innerWidth / 5, 100);
	const MAX_SOCIAL_BUTTON_HEIGHT = Math.max(window.innerHeight / 10, 50);
	const MIN_RATIO_INTERNAL_ANCHORS_MENU = 0.6; // if internal anchors are less than 60%, this is not a menu element, it's probably a socialMedia area
	
	function _getTextSizeAndLength(txtEl){
		const fSize = parseFloat(window.getComputedStyle(txtEl).fontSize);
		console.assert(!isNaN(fSize), "Couldn't parseFloat font size", window.__el2stringForDiagnostics(txtEl));
		return {size: fSize, length: window._getVisInnerTxt(txtEl).length};
	}
	
	function _calcAvgFontSize(txtElArr){
		const sizeLenObjArr = txtElArr.map(_getTextSizeAndLength);
		const sumSize = sizeLenObjArr.reduce((accu, x)=>{
			return accu += x.length * x.size;
		}, 0);
		const sumLength = sizeLenObjArr.reduce((accu, x)=>{
			return accu += x.length;
		}, 0);
		return sumSize/sumLength;
	}
	
	const isItDigit = (() => {
		const charCodeZero = "0".charCodeAt(0);
		const charCodeNine = "9".charCodeAt(0);
		return (n) => {
			return (n >= charCodeZero && n <= charCodeNine);
		};
	})();
	
	// TODO: How to differentiate from "Search" areas? <-- upstream, sort by the presense of "find/search" words
	function findLoginAndSearchAreaAsync(jqSocialButtons, jqMenus, jqForms){ 
		// definition: a) a collection of (computed) controls; b) if it has links (instead of buttons) not external links, not sharing buttons; c) no more than 5 controls; d) no main graphics
		//Algorithm: find controls; exclude menus; look up until pre-conditions met; test if there are deal breakers (outside larger form; larger graphics; too much text; sharing buttons; external links; non-texst/non-button inputs)
		return Promise.all([window.domGetters.getGraphGrPromise("main")]).then(([jqGraphMain])=>{
			const menuEls = jqMenus.toArray();
			const formEls = jqForms.toArray(); // findFormGroups().toArray();
			const sharingBtns = jqSocialButtons.toArray();
			const mainGrEls = jqGraphMain.toArray();
			// 1 - find controls
			const actCntrlArr = window.domGetters.getCntrlGr("actionable").toArray();
			const cntrlArr = window.domGetters.getCntrlGr("computed").toArray().concat(actCntrlArr).filter(cntrlEl => {
				// 2 - exclude menus
				return !menuEls.some(menuEl=>menuEl.contains(cntrlEl));
			});
			// 3 - Look up; map cntrls into potential login areas
			const potentialLoginAreas = cntrlArr.map(cntrlEl=>{
				// 3.1 - If this cntrl is inside a form, return the form
				const containingForm = window._filterOutAncestorElements(formEls.filter(aForm=>aForm.contains(cntrlEl))); // Nested forms are apparently possible -- so getting rid of them
				if(containingForm.length){
					return containingForm[0]; // I really expect max 1 to be found
				}
				// 3.2 - Look up until an ancestor has at least 2 controls
				var currEl = cntrlEl.parentElement;
				while(currEl !== null && cntrlArr.filter(x=>currEl.contains(x)).length < 2){
					currEl = currEl.parentElement;
				}
				return currEl;
			}).filter(el=>el); // filter out duds
			// 4 - Remove duplicates
			const loginAreas = [... new Set(potentialLoginAreas)];
			// 5 - filter out unsuitable controls
			return loginAreas.filter(lgnAreaEl=>{
				// 5.1 - no more than 6 controls (e.g., 2 texts, 2 buttons, and forgot pass / create account)
				const insideCntrlArr = cntrlArr.filter(x=>lgnAreaEl.contains(x));
				if(insideCntrlArr.length > 6){
					return false;
				}
				// 5.2 - no large graphics
				if(mainGrEls.some(x=>lgnAreaEl.contains(x))){
					return false;
				}
				// 5.3 - no long texts
				if(window._getVisInnerTxt(lgnAreaEl).length > MAX_MENU_ITEM_TXT_LENGTH * 2){
					return false;
				}
				// 5.4 - no social buttons inside
				if(sharingBtns.some(x=>lgnAreaEl.contains(x))){
					return false;
				}
				// 5.5 - no external links <-- Maybe do later; doesn't seem to be crucial or likely
				// const extLinks
				// 5.6 - No textareas
				if(insideCntrlArr.some(el=>el.tagName.toLowerCase() === "textarea")){
					return false;
				}
				// 5.6 - No non-acceptable inputs <-- those that would be absolute weird to have in a login area
				const completelyUnacceptableInputs = ["color", "date", "datetime-local", "file", "month", "range", "time", "week", "datetime", "radio"]; // NOTE: radio buttons always come as at least 2 -- so they'd faile the 5.7 test anyway
				const insideActCntrlArr = actCntrlArr.filter(x=>lgnAreaEl.contains(x));
				const hasUnacceptInp = insideActCntrlArr.some(cntrlEl => {
					const tagName = cntrlEl.tagName.toLowerCase();
					return tagName === "input" && completelyUnacceptableInputs.includes(cntrlEl.type.toLowerCase());
				});
				if(hasUnacceptInp){
					return false;
				}
				// 5.7 - - No non-text/button inputs - no more than 1 element <-- unusual, but acceptable in small amounts
				const txtInputs = ["text", "email", "password", "search"];
				const acceptableInputs = ["submit", "reset", "button"].concat(txtInputs);
				const nonTxtBtnCntrls = insideCntrlArr.filter(el=>{
					const tagName = el.tagName.toLowerCase();
					if(tagName === "select" || tagName === "option"){ // I don't remember if 
						return true;
					}
					if(tagName === "input" && !acceptableInputs.includes(el.type.toLowerCase())){
						return true;
					}
					return false;
				});
				if(nonTxtBtnCntrls.length > 1){
					return false;
				}
				// 5.8 - No more than 3 text inputs
				const txtInputCount = insideActCntrlArr.filter(cntrlEl => {
					const tagName = cntrlEl.tagName.toLowerCase();
					return tagName === "input" && txtInputs.includes(cntrlEl.type.toLowerCase());
				}).length;
				if(txtInputCount > 3){
					return false;
				}
				// 5.9 - at least 1 text input
				if(txtInputCount < 1){
					return false;
				}
				// 5.10 - Else it's a functional area
				return true;
			}).map(lgnAreaEl =>{
				// 6 - Assign types
				const insideTexts = window._getFullTextCleanAllButSpaces(lgnAreaEl);
				const insideCntrlArr = cntrlArr.filter(x=>lgnAreaEl.contains(x));
				if(insideCntrlArr.length < 4 && ["find", "search"].some(txt=>insideTexts.indexOf(txt) > -1)){
					lgnAreaEl._funcAreaType = "search";
				}
				if(insideCntrlArr.length < 4 && ["news", "follow", "subscribe"].some(txt=>insideTexts.indexOf(txt) > -1)){
					lgnAreaEl._funcAreaType = "newsletter";
				}
				if(lgnAreaEl._funcAreaType === undefined){
					lgnAreaEl._funcAreaType = "login"; // fallback option -- maybe we should have "other"
				}
				return lgnAreaEl;
			});
		});
		// Detection by text?... Probably only as a fallback option
		// sign-in; log-in, login, signin, subscribe, forgot password, create account, my account, register
	}
	
	function findSocialButtonAreasAsync(jqMenus){ // I fear these will be noisy
		// social media area: a) a collection of icon-only (primarily) external links <-- can also be small-size iframes?...; b) less text than MAX_MENU_ITEM_TXT_LENGTH; c) not surrounded by text <== NOT DOING text thing
		// Algorithm: Find external links and iframes; filter out those with lots of text; filter out large ones (or too small); Filter out those with immediate sibligns with lots of text (or if the immediate parent has lots of text)
		const menuElArr = jqMenus.toArray();
		return Promise.all([window.domGetters.getOtherGrPromise("iframeAsPrims"), window.domGetters.getGraphGrPromise("allNonZero"), window.domGetters.getGraphGrPromise("main"), window.domGetters.getOtherGrPromise("iframeStandAlone"), window.domGetters.getGraphGrPromise("icons")]).then(([jqIframes, jqGraphNonZero, jqGraphMain, jqBigFrames, jqGrIcons])=>{
			// const nonZeroGrArr = jqGraphNonZero.toArray();
			const iconGrArr = jqGrIcons.toArray();
			const mainGrArr = jqGraphMain.toArray();
			const bigFrEls = jqBigFrames.toArray(); // can't be in social buttons/areas
			const currBaseHost = window.hostname2baseHostname(window.location.hostname, {pollEmptyHost: true});
			// 1 - Find external links and iframes;
			const potentialSocialButtons = window.domGetters.getAllVis().filter("a").add(jqIframes).toArray().filter(el => {
				return __testIfLinkIsExternal(el, currBaseHost);
			}).filter(el=>{
				// 1.1 - The links aren't in menus - menus can contains a small amout of external links
				return menuElArr.every(menuEl=>!menuEl.contains(el));
			});
			// 2 - filter out those with lots of text; filter out large ones (or too small);
			var socialButtons = potentialSocialButtons.filter(el=>{
				const inBBox = window._getInnerBBox(el);
				// also ensuring it's not a "pixel"
				return (inBBox.width * inBBox.height) > 10 && inBBox.width < MAX_SOCIAL_BUTTON_WIDTH && inBBox.height < MAX_SOCIAL_BUTTON_HEIGHT && window._getVisInnerTxt(el).length < MAX_MENU_ITEM_TXT_LENGTH;
			});
			// 3 - An SButton Needs to contain a graphic, but not "main"
			// socialButtons = socialButtons.filter(el=>{
			// 	return !mainGrArr.some(x=>el.contains(x)) && nonZeroGrArr.some(x=>el.contains(x));
			// });
			// NOTE: we switched to only allow icons in social buttons - no UI graphics
			socialButtons = socialButtons.filter(el=>{
				// TODO: should we also require that there is only 1 graphic/icon in
				return !mainGrArr.some(x=>el.contains(x)) && iconGrArr.some(x=>el.contains(x));
			});
			// 4 - Trying to join up social buttons in areas
			// 4.a - Look up until an ancestor has another social button or cmpCntrl (or button) included; 4.b - Check: no main graphics; no long texts
			const cmpCntrlEls = window.domGetters.getCntrlGr("computed").toArray().filter(cmpCntrl=>{
				return socialButtons.every(socBtn=>!socBtn.contains(cmpCntrl));
			});
			const allBtns = window._filterOutNestedElements(socialButtons.concat(cmpCntrlEls));
			const socAreas = socialButtons.map(socBtnEl=>{
				var targetEl = socBtnEl;
				var pEl = targetEl.parentElement;
				while(pEl !== null){
					var inclBtns = allBtns.filter(btnEl=>pEl.contains(btnEl));
					const ifTooMuchText = window._getVisInnerTxt(pEl).trim().length > (inclBtns.reduce((a, x)=>a+window._getVisInnerTxt(x).trim().length, 0) + MAX_MENU_ITEM_TXT_LENGTH * 2); // arbitrary; increase/decrease?
					const ifHasBigGraphic = mainGrArr.some(mainGrEl=>pEl.contains(mainGrEl)) || bigFrEls.some(bigFr=>pEl.contains(bigFr));
					if(ifTooMuchText || ifHasBigGraphic){
						// too much text or a main graphic found  -- return targetEl as a soc area
						targetEl._socAreaType = "lonelyBtn";
						inclBtns = allBtns.filter(btnEl=>targetEl.contains(btnEl)); // only keep btns that are in targetEl, not pEl
						targetEl._btnIds = inclBtns.map(x=>x._id).join("~~");
						targetEl._btnUrls = inclBtns.map(x=>x.href || x.src).join("~~");
						return targetEl; // Should we return null instead?...
					}
					// NOTE: should we try to check the area size?...
					if(inclBtns.length > 1){
						// we've found another btn -- stop ascending;
						pEl._socAreaType = "btnColl";
						pEl._btnIds = inclBtns.map(x=>x._id).join("~~");
						pEl._btnUrls = inclBtns.map(x=>x.href || x.src).join("~~");
						return pEl;
					}
					targetEl = targetEl.parentElement;
					pEl = targetEl.parentElement;
				}
				return socBtnEl; // we haven't found what we could call an "area" -- returning the button itself
			});
			return [...new Set(socAreas)];
		});
	}
	
	function __testIfLinkIsExternal(el, currBaseHost){
		// 1.1 - Check if a Url exists
		const url = el.src || el.href;
		if(!url){
			// this is an internal iframe or <a> with href not set -- filter out
			return false;
		}
		// 1.2 - Only http(s)
		if(url.indexOf("http") !== 0){
			return false;
		}
		// 1.3 - Only external urls
		try{
			var hostname = url.split("://")[1].split("/")[0];
		}catch (e){
			console.error("Couldn't extract a hostname from a URL", url, window.__el2stringForDiagnostics(el));
			return false;
		}
		const aUrlBaseHostname = window.hostname2baseHostname(hostname);
		return aUrlBaseHostname !== currBaseHost;
	}
	
	function findMainTxtChunksAsync(jqMainContent, jqMenus, jqOverlays, jqForms){ // <== I have reservations about this group. Do we need it? We already have paragraphs... 
		// Definition: Texts inside the mainContent block; excluding all forms <-- all text-only (no main graphics) siblings within an element -- the element can contain other non-text items <-- length > menuItemLength; mainGraphics are a stopping point (no looking up after that)
		return window.domGetters.getGraphGrPromise("main").then((jqMainGr)=>{
			const mainContentEls = jqMainGr.toArray();
			const forms = jqForms.toArray(); // findFormGroups().toArray();
			// const cmpCntrls = window.domGetters.getCntrlGr("computed").toArray();
			const menuEls = jqMenus.toArray();
			const overlayEls = jqOverlays.toArray();
			const mainGrEls = jqMainGr.toArray();
			// 1 - Get potential mainTxtPrimitives to join up
			const mainTxtPrimitives = window.domGetters.getTxtGr("allNoCntrlNoCompCntrl").toArray().filter(txtEl=>{
				// 1.a - isn't in Forms
				if(forms.some(formEl=>formEl.contains(txtEl))){
					return false;
				}
				// 1.b - is in the mainContent
				if(!mainContentEls.some(mainCntEl=>mainCntEl.contains(txtEl))){
					return false;
				}
				// // 1.c - isn't in Computed controls // Already done in allNoCntrlNoCompCntrl
				// if(cmpCntrls.some(cmpCntrlEl=>cmpCntrlEl.contains(txtEl))){
				// 	return false;
				// }
				// 1.d - isn't in Menus
				if(menuEls.some(menuEl=>menuEl.contains(txtEl))){
					return false;
				}
				return true;
			});
			// 2 - Join txtPrimitives
			const potentialMainTxtChunks = mainTxtPrimitives.map(txtEl=>{
				var aChunk = txtEl;
				while(aChunk.parentElement !== null){
					// check if we're crossing an overlay, and stop if we do; Check if textEl's parent can be a larger chunk <-- we want the largest // if a parent can be a chunk, look up
					if(overlayEls.some(x=>aChunk.parentElement.isSameNode(x)) || !__isItAMainTxtChunk(aChunk.parentElement, mainTxtPrimitives, mainGrEls)){
						// stop searcing and take aChunk.parentElement.childNodes in mainTxtPrimitiveStore as one chunk
						return Array.from(aChunk.parentElement.children).filter(x=>mainTxtPrimitives.includes(x));
					}
					aChunk = aChunk.parentElement;
				}
				return []; // txtEl is not in a chunk
			}).filter(arr=>arr.length).filter(chunkElArr=>{
				// 3 - Filter: innerText > menuItemLength -- so we exclude tiny chunks
				return chunkElArr.reduce((a, x)=>a+window._getVisInnerTxt(x), "").length > MAX_MENU_ITEM_TXT_LENGTH;
			});
			// 4 - reconsile (smaller chunks to be subtracted from larger chunks; empty chunks removed; duplicates to be zeroed and removed)
			const mainTxtChunks = potentialMainTxtChunks.sort((a, b)=>a.length - b.length).slice();
			mainTxtChunks.forEach((chunkElArr, i) => {
				const indArr = (new Array(mainTxtChunks.length - i - 1)).map((x, j)=>i+j+1);
				indArr.forEach(j => {
					mainTxtChunks[j] = mainTxtChunks[j].filter(txtEl=>!chunkElArr.includes(txtEl)); // only keep items that aren't in a smaller chunk (which is current chunkElArr)
				});
			});
			// 5 - filter out small chunks and return
			return mainTxtChunks.filter(arr=>arr.length).filter(chunkElArr=>{
				return chunkElArr.reduce((a, x)=>a+window._getVisInnerTxt(x), "").length > MAX_MENU_ITEM_TXT_LENGTH * 2;
			}).map(chunkElArr=>{
				// assign group ids
				chunkElArr._id = "AsArr_" + window._generateId();
				return chunkElArr;
			});
		});
	}
	
	function __isItAMainTxtChunk(el, mainTxtPrimitives, mainGrEls){
		// b) No main graphics
		if(mainGrEls.some(grEl=>el.contains(grEl))){
			return false;
		}
		// c) sum(el's descendants from mainTxtPrimitives) > 3 * other text
		const txtPrimSubSet = mainTxtPrimitives.filter(x=>el.contains(x));
		const txtPrimSubSetInnerText = txtPrimSubSet.reduce((a, x)=>a+window._getVisInnerTxt(x), "");
		if(txtPrimSubSetInnerText.length < window._getVisInnerTxt(el).length * 0.75){
			return false;
		}
		// d) Should contain a "." - meaning it'd have sentences in it... (or abbreviations, which isn't good..)
		if(txtPrimSubSetInnerText.indexOf(".") === -1){ // this also takes care of possible division by 0 below
			return false;
		}
		// e) the avg length of a text primitive > MAX_MENU_ITEM_TXT_LENGTH <-- This one filters out complicated controls
		if(txtPrimSubSetInnerText.length / txtPrimSubSet.length < MAX_MENU_ITEM_TXT_LENGTH){
			return false;
		}
		return true;
	}
	
	function findFormGroups(headers, footers){
		// Definition: <form> OR collections of (computed) controls (at least 2) that are > 40% of N visible elements, menus excluded <== We'll only use the 1st for now -- I expect too many erroneous detections with the 2nd.
		// EXTRA bit: forms can't have page-level footers/headers in them -- this excludes weird cases of full-page wrapping in a form
		return window.domGetters.getAllVis().filter("form").filter((i, formEl)=>{
			return headers.every(headEl=>!formEl.contains(headEl) && !headEl.isSameNode(formEl)) && footers.every(headEl=>!formEl.contains(headEl) && !headEl.isSameNode(formEl));
		});
	}
	
	const MAX_VIS_PART_HIDDEN_GRAPHIC = 0.3; // if less than 30% of a graphic is visible, we quality it as partially hidden (aka, hidden when detecting rotating banners)
	
	function findRotatingBannersAsync(){
		// Definition: repetitive structure; only one image is visible at a time; many images <-- start from images
		// Algorithm: 1) _findHiddenImages(); 2) look up from each mainGraphic until we find an ancestor with a hidden image; 3) ensure only 1 visible image is inside the parent 4) test the paths to mainGraphic and hidden images -- they need to match;
		return Promise.all([window.domGetters.getGraphGrPromise("main"), window.domGetters.getOtherGrPromise("iframe")]).then(([jqMainGr, jqIfr])=>{
			// 0 - Partially hidden images
			const partHiddGrArr = jqMainGr.toArray().filter(grEl=>{
				// 0.1 - If this is a true graphic, look at its inner bbox, otherwise regular bbox
				var adjB, b;
				if(window._tagSets.media.has(grEl.tagName.toLowerCase())){
					b = window._getInnerBBox(grEl); //, false, {handleFloats: true} <-- no need, images handle floats fine
					adjB = window._getAbsBoundingRectAdjForParentOverflow(grEl, true, false, "inner");
				}else{
					b = window._getFloatProofBBox(grEl);
					adjB = window._getAbsBoundingRectAdjForParentOverflow(grEl, true, false, "normal");
				}
				// 0.2 - Check if graphic is mostly hidden
				return adjB.height * adjB.width < MAX_VIS_PART_HIDDEN_GRAPHIC * b.height * b.width; // keep only gr with vis part less than 30% of their total area
			});
			jqMainGr = jqMainGr.not(partHiddGrArr);
			// 1 - Hidden images
			const hiddenGrArr = _findHiddenImages().concat(partHiddGrArr);
			if(!hiddenGrArr.length){
				return []; // no need to test anything, no hidden images means no banners
			}
			// 2) look up from each mainGraphic until we find an ancestor with a hidden image;
			const ifrArr = jqIfr.toArray(); // because these can't be swapped out of DOM -- triggers iframe reloading
			const mainGrArr = jqMainGr.toArray().filter(grEl=>{
				return !ifrArr.some(ifr=>grEl.contains(ifr)); // because we use swapping for banner detection -- triggers reloading
			});
			const potentialBanners = mainGrArr.map(mainGrEl=>{
				const bannerSiblings = _getBannerSibligns(mainGrEl, hiddenGrArr, ifrArr);
				var currEl = mainGrEl.parentElement;
				while(currEl !== null){
					if(_isThisElAPotentialBanner(currEl, mainGrArr, bannerSiblings)){
						// saving hidden images so we don't have to re-search for them
						currEl._hiddImgs = bannerSiblings.filter(x=>currEl.contains(x));
						// we've found it, save and stop the search
						return currEl;
					}else if(_canThisElParentBeAPotentialBanner(currEl, mainGrArr, bannerSiblings)){
						// a parent can be a potential banner --> continue looking upwards
						currEl = currEl.parentElement;
					}else{
						// stop the search, mainGrEl is not in a banner
						return null;
					}
				}
				// if(currEl && bannerSiblings.length){
				// 	// saving hidden images so we don't have to re-search for them
				// 	currEl._hiddImgs = bannerSiblings.filter(x=>currEl.contains(x));
				// }
				return currEl; // it's null, we've reach HTMLDocument <-- I don't expect to be here often, but it's possible
			}).filter(el=>el);
			return potentialBanners;
		});
	}
	
	function _getBannerSibligns(anImgEl, allHiddenGrEls, ifrArr){
		const cssVisProps = ["position", "top", "left", "bottom", "right", "visibility", "opacity", "display", "z-index"];
		// a - same type/tagName
		const maybeBannerSiblings = allHiddenGrEls
			.filter(hidGrEl=>{
				return !ifrArr.some(ifr=>hidGrEl.contains(ifr)); // to avoid iframe swapping out of DOM and their reloading -- because of how we detect banners below
			})
			.filter(hidGrEl=>!hidGrEl.contains(anImgEl) && !anImgEl.contains(hidGrEl)) // can't be ancestor/descendant of the target element --> it's possible if a child element is taken out of rendering context (e.g., floats)
			.filter(hidGrEl=>hidGrEl.tagName.toLowerCase() === anImgEl.tagName.toLowerCase()); // only same type/tagName elements can be banner siblings <-- checking path-to-parent would filter them down to this anyway -- this also avoids misfires, i.e., when service elements (e.g., buttons as images) are found and tested for being banner siblings
		// b - same size -- replace and check bbox
		const imgBBox = window._getFloatProofBBox(anImgEl); // window.__cpyBBox(anImgEl.getBoundingClientRect()); // any bbox detector would do - so let's use the fastest one (the native) // Clone it so it's not a live object
		const tmpSpan = window.__makeCleanSpan(); // to keep a reference to the swapped elements' positions
		const cssProps2Enforce = window.__cssValsToObj(window.getComputedStyle(anImgEl), cssVisProps);
		const bannerSiblings = maybeBannerSiblings.filter(otherGrEl=>{
			// b.1 - Copy anImgEl's visibility props onto otherGrEl
			const _cssChId = window.__enforceManyCSSPropOnElArr([otherGrEl], cssProps2Enforce);
			// b.2 - Swap imgEl and otherImgEl places
			otherGrEl.replaceWith(tmpSpan);
			anImgEl.replaceWith(otherGrEl);
			// b.3 - Save the new bbox
			// const newBBox = window.__cpyBBox(otherGrEl.getBoundingClientRect());
			const newBBox = window._getFloatProofBBox(otherGrEl);
			// b.4 - Restore everything
			// otherGrEl.replaceWith(anImgEl);
			window.DOMutils.restoreElement(otherGrEl, anImgEl);
			tmpSpan.replaceWith(otherGrEl);
			window.__restoreManyCSSPropOnElArr([otherGrEl], cssVisProps, _cssChId);
			// b.3 - Compare bboxes
			const thr = 5; // pixels. If difference in bbox edges is larger than this, we count the 2 bboxes as different
			return window._cmpBBoxes(imgBBox, newBBox, thr); // are 2 bboxes the same?
		});
		return bannerSiblings;
	}
	
	function _canThisElParentBeAPotentialBanner(thisEl, visGrArr, hiddenGrArr){
		// thisEl must contain only 1 visible graphic and no hiddenGraphics
		const visGrInThisEl = visGrArr.filter(x=>thisEl.contains(x));
		const hidGrInThisEl = hiddenGrArr.filter(x=>thisEl.contains(x));
		return visGrInThisEl.length === 1 && hidGrInThisEl.length === 0;
	}
	
	function _isThisElAPotentialBanner(thisEl, visGrArr, hiddenGrArr){
		// to be used in findRotatingBannersAsync
		// A banner needs:   
		// 1 - to only contain 1 visible graphic element;
		const visGrInThisEl = visGrArr.filter(x=>thisEl.contains(x));
		console.assert(visGrInThisEl.length !== 0, "The supplied thisEl must contain at least 1 graphic ==> debug upstream");
		if(visGrInThisEl.length !== 1){
			return false;
		}
		// 2 - contain at least 1 hidden graphic;
		const hidGrInThisEl = hiddenGrArr.filter(x=>thisEl.contains(x));
		if(hidGrInThisEl.length <= 0){
			return false;
		}
		// 3 - have the same paths from the visible graphic and (most) hidden graphics
		const visGrPath = __pathFromChild2Ancestor(visGrInThisEl[0], thisEl);
		const hidGrPaths = hidGrInThisEl.map(hidGrEl=>__pathFromChild2Ancestor(hidGrEl, thisEl));
		const pathMatches = hidGrPaths.map(hidGrPath=>__are2PathsEqual(visGrPath, hidGrPath));
		const nMatch = pathMatches.reduce((a, x)=>a+x, 0);
		var nMatchRequired = pathMatches.length;
		if(pathMatches.length > 4){
			// allow for a bit of flexibility -- 80% of paths should match
			nMatchRequired *= 0.8;
		}
		return nMatch >= nMatchRequired;
	}
	
	function __are2PathsEqual(path1, path2){
		// the paths are arr of tagNames, showing a path between an ancestor and descendant
		if(path1.length !== path2.length){
			return false;
		}
		return path1.join("_") === path2.join("_");
	}
	
	function __pathFromChild2Ancestor(childEl, ancestorEl){
		// Finds all tagNames from a childEl to ancestorEl
		// TODO: use in menu detection
		console.assert(ancestorEl.contains(childEl), "Achtung! A supposed ancestor does not contain the supplied child element", window.__el2stringForDiagnostics(ancestorEl), " |||||| ", window.__el2stringForDiagnostics(childEl));
		const tags = [childEl.tagName];
		var currEl = childEl;
		while(currEl !== ancestorEl){
			currEl = currEl.parentElement; // if currEl reaches HTMLDocument, let it fall - we can't be there anyway
			tags.unshift(currEl.tagName);
		}
		return tags;
	}
	
	function _findHiddenImages(){
		// needed to detect banners <-- we don't categorize anything, mainly because we can't have the size/bbox
		const allVisEls = window.domGetters.getAllVis().toArray();
		const allInvisEls = $("*").not(allVisEls).toArray();
		const invisGrEls = window.__filterElementsNoParentMatch($(allInvisEls), window._tagSets.media, false).toArray();
		const bgInvisGrEls = window.__filterElementsNoParentMatch($(allInvisEls), window._tagSets.media, true).toArray().filter(el=>{
			return (window.getComputedStyle(el)["background-image"].toLowerCase().indexOf("url") !== -1);
		});
		return invisGrEls.concat(bgInvisGrEls);
	}
	
	function findMainContentBlockAsync(jqFooters, jqHeaders, jqOverlays){
		// Main content definition: a) a solid block content; b) Can have multiple elements; c) envelops all long texts/paragraphs; d) Includes vertical menus <-- We shouldn't depend too much on other semantic groups, else errors will propagate; e) Excludes footer/header and overlays
		// Algorithm: 1) exclude footers/headers from visibile element; 2) find an ancestor for each non-header/footer primitive - the highest that includes no header/footer primitives; 3) remove duplicates
		// NOTE: we don't care about vertical menus --> they'll be included automatically, because we excluded them from footers/headers
		return Promise.all([window.domGetters.getOtherGrPromise("allPrimitives"), window.domGetters.getOtherGrPromise("iframe")]).then(([jqAllPrimitives, jqIFrames])=>{
			const overlElArr = jqOverlays.toArray();
			const allPrimArr = jqAllPrimitives.add(jqIFrames).toArray().filter(primEl => !overlElArr.includes(primEl)); // also excluding primitives belonging to overlays
			const footElArr = jqFooters.toArray();
			const headElArr = jqHeaders.toArray();
			// 1) exclude footers/headers from visibile element;
			const headFootPrimArr = allPrimArr.filter(el=>{
				return footElArr.some(footEl=>footEl.contains(el)) || headElArr.some(headEl=>headEl.contains(el));
			});
			const mainBodyPrimArr = allPrimArr.filter(el=>!headFootPrimArr.includes(el));
			// 2) find an ancestor for each non-header/footer primitive - the highest that includes no header/footer primitives;
			// var _warnShown = false;
			var _bodyIsMainContent = false;
			const mainBodyAncestArr = mainBodyPrimArr.map(primEl=>{
				if(_bodyIsMainContent){
					return null; // speed-up <-- avoiding search again if we know we'll look all the way up to <body> for each primitive
				}
				var currEl = primEl;
				var pEl = currEl.parentElement;
				// until we reach HTMLdocument or find an ancestor that contains at least one el from headFootPrimArr
				while(pEl !== null && !headFootPrimArr.some(hfPrimEl=>pEl.contains(hfPrimEl))){
					currEl = pEl;
					pEl = currEl.parentElement;
				}
				if(pEl === null){
					console.warn("We've reached HTMLDocument while looking up for an ancestor that contained no primtives from header/footer --> this can only be if header/footer are empty ==> double check: , footElArr.length", footElArr.length, "headElArr.length:", headElArr.length, "headFootPrimArr.length", headFootPrimArr.length);
					_bodyIsMainContent = true;
					return window.document.body;
				}
				// if pEl === null, we should show a warning and return <body>
				return currEl; // the last 'parent' element that had no headFootPrimArr elements
			}).filter(el=>el);
			// 3) remove duplicates
			return [... new Set(mainBodyAncestArr)];
		});
		
	}
	
	function __path2arr(pathname){
		return pathname.split("/").filter(str => str.length);
	}
	
	function findHeadersFootersAsync(jqVertMenus, jqOverlays){
		// Header Definition: <-- a) Close to Top, no breaks between parts/pieces, b)Full Width (of body, not window <-- Look for the first <div> that has more than 1 visible descendant -- then look for it's internalBBox width); c) Contains no or little of main texts -- no long texts; d) Less than 25% of screen height; e) No vertical menus; f) Maybe be top <header>; g) can have several items in it...; h) Isn't the main body <-- Detect it first?...; i) Should contain the main logo, if there is a logo
		// Algorithm: look for full-width divs/sections from top down, until we find an element that no longer qualifies as a part of header <-- exclude html/body and all primitives from bbox evaluation/search
		// If we keep finding suitable sections underneath the 25% of screen height, roll back to the single one that contains the logo
		return Promise.all(["iframeAsPrims", "allPrimitivesNoCmpCntrl", "iframe"].map(window.domGetters.getOtherGrPromise)).then(([jqIfrAsPrims, jqAllPrims, jqIFrames])=>{
			const jqAllVis = window.domGetters.getAllVis();
			const overlayEls = jqOverlays.toArray();
			// NOTE: I don't understand why I exclude primitives --> they can be a part of a footer/header, without them being wrapped ==> keep primitives /// jqAllPrimitives.add(jqIFrames)
			// NOTE: I also don't understand why I excluded iframes -- I should add them instead
			const allVisNonPrimitiveEls = jqAllVis.add(jqIFrames).not("html, body").toArray().filter(el=>{
				// 0 - Filter out everything nested in overlays <-- Overlays are often close to the top/root, but shouldn't be counted in root evaluation
				return !overlayEls.some(overlEl=>overlEl.contains(el));
			});
			// 1 - find "root" - the first-from-body visible non-primitive element that has more than 1 child - so we know what "full-screen-width" means for this page
			var rootEl = window.document.body;
			var rootVisChildren = __findVisibleNearestDescendants(rootEl, allVisNonPrimitiveEls);
			// var rootVisChildren = Array.from(rootEl.children).filter(allVisNonPrimitiveEls.includes);
			while(rootVisChildren.length === 1){
				rootEl = rootVisChildren[0];
				// reassign children
				// rootVisChildren = Array.from(rootEl.children).filter(allVisNonPrimitiveEls.includes);
				rootVisChildren = __findVisibleNearestDescendants(rootEl, allVisNonPrimitiveEls);
			}
			if(rootVisChildren.length === 0){
				return {rootEl: rootEl, rootVisChildren: rootVisChildren}; // for whatever reason, we've failed to find "children" of the root element ==> no candidates for being a header
			}
			// 2 - Test each rootVisChildren for being a header El; Those that don't qualify, test them for potentially containing headers - if they may, do recursion
			// const FULL_SCREEN_WIDTH = window._getInnerBBox(rootEl).width * (1 - FULL_SCREEN_WIDTH_TOLERANCE);
			const FULL_SCREEN_WIDTH = window._getFloatProofBBox(rootEl, {handleFloats: true}).width * (1 - FULL_SCREEN_WIDTH_TOLERANCE);
			const headerCandidates = _recursiveSearchForHeadersOrFooters(rootEl, allVisNonPrimitiveEls, jqVertMenus.toArray(), FULL_SCREEN_WIDTH);
			const footerCandidates = _recursiveSearchForHeadersOrFooters(rootEl, allVisNonPrimitiveEls, jqVertMenus.toArray(), FULL_SCREEN_WIDTH, {ifHeaders: false});
			// 3 - We applied relaxed criteria to headers/footers -- filter them
			var headers = headerCandidates.filter((el)=>window._getFloatProofBBox(el).bottom <= MAX_HEADER_BOTTOM_COORD);
			var footers = footerCandidates.filter((el)=>window._getFloatProofBBox(el).top >= MAX_FOOTER_TOP_COORD());
			// 4 - If any of the collections are empty (e.g., one giant top element) -- fall back on chosing top/bottom element
			if(!headers.length && headerCandidates.length){
				headers = headerCandidates.sort((a, b)=>window._getFloatProofBBox(a).top-window._getFloatProofBBox(b).top).slice(0, 1); // lowest "top" // we always have items because we checked headerCandidates.length
			}
			if(!footers.length && footerCandidates.length){
				footers = footerCandidates.sort((a, b)=>window._getFloatProofBBox(b).bottom-window._getFloatProofBBox(a).bottom).slice(0, 1); // highest "bottom"
			}
			// 5 - Filter out headers/footers that have non-header/footer primitives above/below them -- ensuring that there are no gaps between our multi-line multi-item headres/footers
			const allPrimsElArr = jqIfrAsPrims.add(jqAllPrims).toArray();
			return {headers: __filterFootHeadForGaps(headers, true, allPrimsElArr), footers: __filterFootHeadForGaps(footers, false, allPrimsElArr), rootEl: rootEl, rootVisChildren: rootVisChildren};
		});	
	}
	
	function __filterFootHeadForGaps(allHeadEls, ifHead, allPrimsElArr){
		// checking for primitives that are vedged between header/footer elements
		const nonHeadPrims = allPrimsElArr.filter(primEl=>{
			// filter out full-body bg elements from top/bottom comparison
			return !allHeadEls.some(headEl=>primEl.contains(headEl));
		}).filter(primEl=>allHeadEls.every(headEl=>!headEl.contains(primEl)));
		// const nonHeadPrimBBoxes = nonHeadPrims.map(el=>el.getBoundingClientRect());
		const nonHeadPrimBBoxes = nonHeadPrims.map(el=>window._getAbsBoundingRectAdjForParentOverflow(el));
		return allHeadEls.filter(headEl=>{
			const hBBox = window._getFloatProofBBox(headEl);
			return nonHeadPrimBBoxes.every(primBBox=>{
				// return ifHead?primBBox.top >= hBBox.bottom:primBBox.bottom <= hBBox.top;
				return ifHead?primBBox.top >= hBBox.top:primBBox.bottom <= hBBox.bottom;
			});
		});
	}
	
	function _recursiveSearchForHeadersOrFooters(rootEl, allVisNonPrimitiveEls, verMenusElArr, FULL_SCREEN_WIDTH, settings = {ifHeaders: true}){
		// const _testF = settings.ifHeaders?__isThisElAHeader:__isThisElAFooter;
		const seachType = settings.ifHeaders?"header":"footer";
		const _recF = (rootEl)=>{
			const rootVisChildren = __findVisibleNearestDescendants(rootEl, allVisNonPrimitiveEls);
			const headers = rootVisChildren.filter(el=>__isThisElAFooterHeader(el, FULL_SCREEN_WIDTH, verMenusElArr, seachType));
			if(headers.length < rootVisChildren.length){
				// any of nonHeader children that themselves may contain header?
				const nonHeaders = rootVisChildren.filter(childEl=>!headers.includes(childEl));
				nonHeaders.filter(el=>{
					return __isThisElChildrenCanBeFooterHeader(el, FULL_SCREEN_WIDTH, seachType);
					// // only 1 condition -- full width
					// return window._getOuterBBox(el).width >= FULL_SCREEN_WIDTH;
				}).forEach((potentialHeaderRoot, i) => {
					// recursion lives HERE
					headers.push(..._recF(potentialHeaderRoot));
				});
			}	
			return headers;
		};
		return _recF(rootEl);
	}
	
	function __isThisElChildrenCanBeFooterHeader(el, FULL_SCREEN_WIDTH, headerOrFooter = "header"){
		console.assert(headerOrFooter === "header" || headerOrFooter === "footer", "__isThisElAFooterHeader needs a headerOrFooter chosen", window.location.href);
		// 1 - Full width
		const outerBBox = window._getOuterBBox(el, {handleFloats: true});
		if(outerBBox.width < FULL_SCREEN_WIDTH){
			return false;
		}
		const innerBBox = window._getInnerBBox(el, {handleFloats: true});
		if(headerOrFooter === "header"){
			// 2 - Top edge starts within 25% of screen width in height
			if(innerBBox.top > MAX_HEADER_CANDIDATE_BOTTOM_COORD){
				return false;
			}
		}else{
			// 2 - Close to the bottom of the page
			if(innerBBox.bottom < MAX_FOOTER_CANDIDATE_TOP_COORD()){ 
				return false;
			}
		}
		return true;
	}
	
	function __isThisElAFooterHeader(el, FULL_SCREEN_WIDTH, verMenusElArr, headerOrFooter = "header"){
		console.assert(headerOrFooter === "header" || headerOrFooter === "footer", "__isThisElAFooterHeader needs a headerOrFooter chosen", window.location.href);
		const ifHead = headerOrFooter === "header";
		// 1 - Full width
		const outerBBox = window._getOuterBBox(el, {handleFloats: true});
		if(outerBBox.width < FULL_SCREEN_WIDTH){
			return false;
		}
		const innerBBox = window._getInnerBBox(el, {handleFloats: true});
		if(ifHead){
			// 2 - No more than 25% of screen width in height
			if(innerBBox.bottom > MAX_HEADER_CANDIDATE_BOTTOM_COORD){ // we * 2, so later we can see if any Header elements are too low -- a reason to fallback on a single element that includes the Logo
				return false;
			}
		}else{
			// 2 - Close to the bottom of the page
			if(innerBBox.top < MAX_FOOTER_CANDIDATE_TOP_COORD()){ 
				return false;
			}
		}
		// 3 - No major texts (text length)
		const maxLen = ifHead?MAX_HEADER_TXT_LENGTH:MAX_FOOTER_TXT_LENGTH;
		if(window._getVisInnerTxt(el).length > maxLen){
			return false;
		}
		// 4 - No vertical menus -- for headers only; footers can have them
		if(ifHead){
			if(verMenusElArr.some(x=>el.contains(x))){
				return false;
			}	
		}
		return true;
	}
	
	function __findVisibleNearestDescendants(el, allVisNonPrimitiveEls){
		// to be used in findHeaderAsync
		// For whatever reason, direct children may be "invisible", so we want to step in them and look for the "actual" - i.e., visible - children of an element
		// var rootVisChildren = Array.from(el.children).filter(x=>allVisNonPrimitiveEls.includes(x));
		const directRootChildren = Array.from(el.children).filter(el=>el.nodeType === document.ELEMENT_NODE);
		const rootVisChildren = directRootChildren.filter(x=>allVisNonPrimitiveEls.includes(x));
		if(rootVisChildren.length !== directRootChildren.length){
			// fallback version - find "nearest" visible descendant: NEW addition: find descendants for all "invisible elements"
			const nearestVisChildr = directRootChildren.filter(x=>!rootVisChildren.includes(x)).map(invisEl=>{
				const elVisDescendants = allVisNonPrimitiveEls.filter(x=>invisEl.contains(x) && !invisEl.isSameNode(x));
				const pathsToEl = elVisDescendants.map(descEl => {
					var distance = 1;
					while(descEl !== el){
						distance++;
						descEl = descEl.parentElement;
						console.assert(descEl !== null, "We've just checked 'el.includes' -- how is it possible a supposed descendant isn't a descendant?... ==> debug");
					}
					return distance;
				}); // A bit expensive, but I want to avoid recursion (top-down look-up would involve recursion)
				const minPath = Math.min(...pathsToEl);
				const minPathElI = pathsToEl.reduce((a, dist, i)=>{
					if(dist === minPath){
						a.push(i);
					}
					return a;
				}, []);
				return elVisDescendants.filter((el, i)=>{
					return minPathElI.includes(i);
				});
			}).flat();
			// adding non-direct children in return res
			rootVisChildren.push(...nearestVisChildr);
		}
		// NOTE: it's possible that no visible children exist - e.g., if it's a click-capturing overlay
		// console.assert(rootVisChildren.length || ["iframe", "img"].includes(el.tagName.toLowerCase()), "We've failed to find visible 'children' ==> debug, ", window.__el2stringForDiagnostics(el)); // iframes don't show their children // NOTE: there may be some other elements that have no children -- should we remove this assert?...
		return rootVisChildren;
	}
	
	function findLogosAsync(headers){
		// definition: images inside links pointing to the current location/href or more basic one (no path)
		// fallback: if none is found, e.g., because it has "index.html" added in <a>'s href, then take // the most left-top non-icon image in a link or computed control
		// algorithm: a) find images; b) look up until we find <a>; c) <a> can't contain other images, controls, or long texts; d) check link href; e) if none found, do fallback
		return Promise.all([window.domGetters.getGraphGrPromise("main"), window.domGetters.getGraphGrPromise("allNonZero"), window.domGetters.getCntrlGr("real")]).then(([jqMainGr, jqNonZeroGr, jqCntrl])=>{
			// z) Prep
			const cntrlElArr = jqCntrl.toArray();
			const nonZeroGrArr = jqNonZeroGr.toArray();
			// a) find images;
			const visMainImgArr = jqMainGr.toArray();
			// b) look up until we find <a>;
			const currBaseHost = window.hostname2baseHostname(window.location.hostname, {pollEmptyHost: true});
			const potentialLogoAnchors = visMainImgArr.map(imgEl=>{
				var pEl = imgEl.parentElement;
				while(pEl !== null && pEl.tagName.toLowerCase() !== "a"){
					pEl = pEl.parentElement;
				}
				if(pEl !== null){
					// c1) <a> can't contain other images
					if(nonZeroGrArr.filter(x=>pEl.contains(x)).length > 1){
						return null;
					}
					// c2) no controls
					if(cntrlElArr.filter(x=>pEl.contains(x)).length > 0){
						return null;
					}
					// c3) no long texts;
					if(window.cleanString(window._getVisInnerTxt(pEl)).length > MAX_LOGO_TEXT_LENGTH){
						return null;
					}
					// c4) the link is not external
					if(__testIfLinkIsExternal(pEl, currBaseHost)){
						return null;
					}
				}
				return pEl;
			}).filter(el=>el);
			// d) SIMPLIEST path search - check link href refers to the homepage - it does if 1) it has no path; 2) it equals the most top-left img <a>'s path; 3) it's simpler than '2'; 4) if none left, choose the simplest path and compare against it - EXTRA addition: an image must be in a header element
			// d0.1) Check if we have images in a header
			const potentialLogoAnchorsInHead = potentialLogoAnchors.filter(logEl=>headers.some(headEl=>headEl.contains(logEl)));
			if(!potentialLogoAnchors.length || !potentialLogoAnchorsInHead.length){
				// FALLBACK 2: - when there are no headers detected ==> check a tl image's src for "logo"
				if(!headers.length){
					const imgWithLogoInSrc = visMainImgArr.filter(imgEl=>{
						const st = window.getComputedStyle(imgEl);
						const src = (imgEl.currentSrc || imgEl.src) || window._urlFromCssStr(st["background-image"]);
						const b = window._getFloatProofBBox(imgEl);
						const notGiant = b.width < window.innerWidth / 2 && b.height < window.innerHeight / 2;
						return notGiant && src && src.toLowerCase().indexOf("logo") > -1; // if it's a non-url img, I can't do much - filter it out
					});
					return (imgWithLogoInSrc.length)?[_findMostTopLeftItem(imgWithLogoInSrc)]:[];
				}
				// FALLBACK - return the topmost image from headers -- no anchors, just plain images
				const imgsInHeads = visMainImgArr.filter(imgEl=>headers.some(headEl=>headEl.contains(imgEl)));
				return (imgsInHeads.length)?[_findMostTopLeftItem(imgsInHeads)]:[];
				// NOTE: we can apply additional criteria, e.g., img src containing "logo"
			}
			// d1) Find the most top-left image
			const topLeftMostImg = _findMostTopLeftItem(potentialLogoAnchorsInHead);
			const topLeftMostImgPathname = topLeftMostImg.pathname;
			console.assert(topLeftMostImgPathname !== undefined, "no most top-left image/anchor found -- we must have had at least 1 element, so this can't be --> debug");
			// d2) Filter Anchors
			const topleftImgPathArr = __path2arr(topLeftMostImgPathname);
			// TODO: REMOVE the check for simplest vs topLeftMost match after debug
			const simplestPathArr = potentialLogoAnchorsInHead.map(a=>__path2arr(a.pathname)).reduce((a, x)=>{
				if(a.length > x.length){
					return x;
				}
				if(a.length === x.length){
					// choose the path with fewer characters in it <-- quite arbitrary, but I can't think of anything better...
					if(a.join("").length > x.join("").length){
						return x;
					}
				}
				return a; // we already have the shortest path
			});
			if(simplestPathArr.join("") !== topleftImgPathArr.join("")){
				console.warn("The top-left-most img/a doesn't have the simplest pathname: topleftImgPathArr", topleftImgPathArr.join("/"), " VS simplestPathArr: ", simplestPathArr.join("/"), "==> MAKE CHANGES?...");
			}
			// d2.0) Keep Anchors if their paths
			const __rebuiltTopLeftMostImgPathname = topleftImgPathArr.join("/"); // To avoid potential issues with the closing "/"
			const logoAnchors = potentialLogoAnchors.filter(anchEl=>{
				// d2.0) - href has no # -- this is often used to redirect with js to random locations
				if(anchEl.href.indexOf("#") > -1){
					return false;
				}
				const currPathArr = __path2arr(anchEl.pathname);
				// d2.1) are empty
				if(!currPathArr.length){
					return true;
				}
				// d2.2) equal the most top-left img <a>'s path
				if(__rebuiltTopLeftMostImgPathname === currPathArr.join("/")){ // again, rebuilding pathnames to avoid issues with the closing "/" present/notPresent while being the same URL in practice
					return true;
				}
				// d2.3) is simpler than the top-left img <a>'s path
				if(topleftImgPathArr.length > currPathArr.length){
					return true;
				}
				// otherwise, not a logo
				return false;
			});
			return logoAnchors.length?logoAnchors:[topLeftMostImg];
		});
	}
	
	function _findMostTopLeftItem(itemArr){
		// NOTE: the code was originally for images - hence variable names
		if(!itemArr.length){
			return undefined;
		}
		const imgBBoxes = itemArr.map(window._getFloatProofBBox);
		// const imgBBoxes = itemArr.map(window._getInnerBBox);
		// const topY = imgBBoxes.reduce((a, bbox)=>{
		// 	if(bbox.y < a){
		// 		return bbox.y;
		// 	}
		// 	return a;
		// }, window.window.getScrlEl().scrollHeight);
		// const topLeftMostImgI = imgBBoxes.reduce((a, bbox, i)=>{
		// 	if(bbox.y < (topY + 10)){ // allow 10 pixels of tolerance - arbitrary; 
		// 		a.push({i: i, bbox: bbox});
		// 	}
		// 	return a;
		// }, []).reduce((a, iBBox)=>{
		// 	// if we have more than 1 img at the top, choose the left-most
		// 	if(a.bbox.x > iBBox.bbox.x){
		// 		return iBBox; // replace the iBBox saved in "a"
		// 	}
		// 	return a;
		// }).i;
		// NOTE: we switched to "bottom" instead of "y" because of some giant images - they clearly aren't top-left most <-- No, it'll lead to other misclassifications; But we do switch from "x" to "right" + we should add a size limitation
		const topY = imgBBoxes.reduce((a, bbox)=>{
			if(bbox.y < a){
				return bbox.y;
			}
			return a;
		}, window.window.getScrlEl().scrollHeight);
		const topLeftMostImgI = imgBBoxes.reduce((a, bbox, i)=>{
			if(bbox.y < (topY + 10)){ // allow 10 pixels of tolerance - arbitrary; 
				a.push({i: i, bbox: bbox});
			}
			return a;
		}, []).reduce((a, iBBox)=>{
			// if we have more than 1 img at the top, choose the left-most
			if(a.bbox.right > iBBox.bbox.right){
				return iBBox; // replace the iBBox saved in "a"
			}
			return a;
		}).i;
		return itemArr[topLeftMostImgI];
	}
	
	function getMenusAsync(){
		// Menu types: vertical, horizontal, mixed; nested (true/false)
		// Menu definition: a) contains links, more than one (we won't account for link immitation for now - a bit of a fringe case, expensive to account for timewise), or computed controls or buttons (or input[button]); b) repetitive structure -- only upwards, because it can have nested folded items; b1) can have delimiters - so mostly repetitive structure; c) links aren't majority external (same 2nd level hostname); d) No large images; e) No long texts; f) No controls inside; g) No major (size, amount of text, number of controls) other elements
		// 0 - Prep; Find all potential menu items;
		// any short piece of text; any link; any button; any icon; <-- all can be menu items
		// window.domGetters.getGraphGrPromise("allNonBgBg"), window.domGetters.getGraphGrPromise("icons")
		return Promise.all([window.domGetters.getGraphGrPromise("main"), window.domGetters.getGraphGrPromise("icons"), window.domGetters.getOtherGrPromise("allPrimitivesNoCmpCntrl"), window.domGetters.getOtherGrPromise("iframeStandAlone")]).then(([jqGrMain, jqIcons, jqNonCmpPrimitives, jqBigIfr])=>{
			const iconArr = jqIcons.toArray();
			// const nonIconGrArr = jqGrNonBg.toArray().filter(el=>!iconArr.includes(el));
			const nonIconGrArr = jqGrMain.toArray();
			const bigIfrArr = jqBigIfr.toArray();
			const allAnchorElArr = window.domGetters.getAllVis().filter("a").toArray();
			const punctRegEx = /[\.,\?\!;:]/;
			const allTxtArr = window.domGetters.getTxtGr("allNoCntrl").toArray();
			const allTxtEls = allTxtArr.filter((el)=>{
				// 0.1 - no long texts
				return window.cleanString(window._getVisInnerTxt(el)).length < MAX_MENU_ITEM_TXT_LENGTH;
			}).filter((el)=>{
				// not in anchors
				return allAnchorElArr.every(anchEl=>!anchEl.contains(el));
			}).filter((el)=>{
				// can't have punctuation in it
				return !punctRegEx.test(window._getVisInnerTxt(el));
			}).filter(el=>{
				// last addition - a pointer cursor on hover
				return window.getComputedStyle(el, ":hover").cursor === "pointer"; // if someone know how to assign an event handler on a piece of text, they should also know how to change a cursor
			});
			// NOTE: we'll exclude buttons altogether - buttons are for on-page actions, not menus <-- we don't want to classify, e.g., 3 image conversion actions as a menu
			// const jqBtn = window.domGetters.getCntrlGr("actionable").filter((i, el)=>{
			// 	// 0.2 - only buttons
			// 	return el.tagName.toLowerCase() === "button" || (el.type !== undefined && el.type.toLowerCase() === "button");
			// }).filter((i, el)=>{
			// 	// not in anchors
			// 	return allAnchorElArr.every(anchEl=>!anchEl.contains(el));
			// });
			const currBaseHost = window.hostname2baseHostname(window.location.hostname, {pollEmptyHost: true});
			const _anchorCntEls = iconArr.concat(allTxtArr);
			const jqAnchors = $(allAnchorElArr).filter((i, el)=>{
				// 0.2 - Can't be about address
				if(["mailto:", "tel:"].some(x=>el.href.indexOf(x) > -1)){
					return false;
				}
				// 0.3 - Needs to have some content in it -- we don't take colored bg as menu items
				if(_anchorCntEls.every(cntEl=>!el.contains(cntEl))){
					return false;
				}
				// 0.4 - not long texts
				if(window.cleanString(window._getVisInnerTxt(el)).length >= MAX_MENU_ITEM_TXT_LENGTH){
					return false;
				}
				// 0.5 - not large images --> which means no graphics besides icons
				if(nonIconGrArr.some(x=>el.contains(x))){
					return false;
				}
				return true;
			});
			// 0.6 - Combine potential menu items - Exclude overlaps between anchors and primitives
			// const _anchorsAsArr = jqAnchors.toArray();
			// const potentialMenuItemEls = jqAnchors.add(jqTxt.add(jqBtn).add(jqIcons).filter((i, el)=>{
			// 	return !_anchorsAsArr.some(anchorEl=>anchorEl.contains(el)); // if a anchor contains a primitive, exclude that primitive // <== But here I exclude anchors?... Why?
			// })).toArray();
			const potentialMenuItemEls = window._filterOutNestedElements(jqAnchors.add(allTxtEls)); // .add(iconArr) <== NOTE: icons outside <a> were causing misclassifications
			// 1 - Find all items that may qualify as menus
			// 1.1 - navs
			const navEls = window.domGetters.getAllVis().filter("nav, menu").toArray();
			// 1.2 - computed navs
			const cmpNavElArr = [... new Set(potentialMenuItemEls.map(menuItemEl=>{
				// 1.2a - Look up until we find another potentialMenuItem contained in an ancestor <-- new Set takes care of duplicates
				var ancestorEl = menuItemEl.parentElement;
				while(ancestorEl !== null && !__ancestorContainsOtherElsFromElArr(ancestorEl, menuItemEl, potentialMenuItemEls)){
					ancestorEl = ancestorEl.parentElement;
				}
				return ancestorEl;
			}).filter(el=>{
				// filtering out nulls -- if we produced some above by reaching <document>
				return el;
			}))];
			// 2 - Test potentialMenus
			const _cmpBtnEls = window.domGetters.getCntrlGr("_cmpBtn").toArray(); // native controls that are composite
			const _nonBtnCntrls = window.domGetters.getCntrlGr("actionable").add().toArray().concat(_cmpBtnEls);
			// const _nonCmpPrimitives = jqNonCmpPrimitives.toArray();
			const menuEls = cmpNavElArr.filter(menuEl=>{
				// filter out potential menus that are nested in <nav>
				// return navEls.every(navEl=>!navEl.contains(menuEl));
				return true; // NOTE: I don't understand why I had this exclusion criterion
			}).filter(menuEl=>{
				// filter out potential menus that contain <nav> <-- high level elements, like <body> aren't menus
				return navEls.every(navEl=>!menuEl.contains(navEl));
			}).filter(menuEl=>{
				return menuEl.tagName.toLowerCase() !== "body"; // <-- lonely "menu" items would have body as its lowest common ancestor with other items, so filter out such cases
			}).concat(navEls).filter(menuEl=>{
				// no more than 1 big graphic inside And no iframes <== LATER: Why do I allow 1 big graphic?... Just zero it...
				// can't have large graphics/iframes inside
				return nonIconGrArr.filter(mainGrEl=>menuEl.contains(mainGrEl)).length < 1 && bigIfrArr.every(ifr=>!menuEl.contains(ifr));
			}).filter(menuEl=>{
				// can't have <br> // Extra: unless this br is inside an <a> <-- not sure about this one; cut it if it causes trouble... 
				// return !menuEl.querySelectorAll("br").length;
				return !Array.from(menuEl.querySelectorAll("br")).filter(br=>br.parentElement.tagName.toLowerCase() !== "a").length;
			}).filter(menuEl=>{
				const thisMenuItems = potentialMenuItemEls.filter(x=>menuEl.contains(x));
				// 2.0 - At least 3 menu items
				if(thisMenuItems.length < 3){
					return false;
				}
				// 2.0.1 - Same font size for items // NEW: most items same size, e.g., 90% of them
				const fSize = parseFloat(window.getComputedStyle(thisMenuItems[0])["font-size"]);
				console.assert(!isNaN(fSize), "failed to get font size for a menu item");
				// const allFontSizesSame = thisMenuItems.every(el=> Math.abs(parseFloat(window.getComputedStyle(el)["font-size"]) - fSize) < 0.5);
				const MAX_NON_SAME_SIZE_ITEM_RATIO = 0.15;
				const allFontSizesSame = thisMenuItems.filter(el=> Math.abs(parseFloat(window.getComputedStyle(el)["font-size"]) - fSize) < 0.5).length >= Math.ceil(thisMenuItems.length * (1 - MAX_NON_SAME_SIZE_ITEM_RATIO));
				if(!allFontSizesSame){
					return false;
				}
				const thisMenuNonItemPrimitives = jqNonCmpPrimitives.toArray().filter(x=>menuEl.contains(x)).filter(primEl=>thisMenuItems.every(itemEl=>!itemEl.contains(primEl) && !primEl.contains(itemEl)));
				// 2.1 - No major (size, amount of text, number of controls) other (non menuItem) elements
				// 2.1.1 - number of items
				if(thisMenuNonItemPrimitives.length > thisMenuItems.length / 2){
					return false;
				}
				// 2.1.2 - combined text length // NOTE: what do we do if menu items are icons?... <-- This wouldn't work then
				const nonItemPrimText = thisMenuNonItemPrimitives.reduce((a, el)=>a+window._getVisInnerTxt(el), "");
				if(nonItemPrimText.length > MAX_MENU_ITEM_TXT_LENGTH * 2){
					return false;
				}
				// 2.1.3 - Area size <-- This probably also accounts for non-icon images, but // DEBUG: it later
				// const nonItemArea = __el2Area(menuEl); //thisMenuNonItemPrimitives.reduce((a, el)=>a+__el2Area(el), 0);
				// const itemArea = thisMenuItems.reduce((a, el)=>a+__el2Area(el), 0);
				// if(nonItemArea > itemArea * 2.5){ // NOTE: 2.5 is arbitrary // NOTE: doesn't work: even 10 is too little sometimes
				// 	return false;
				// }
				// NOTE: old approach - failed with giant "menus" containing lots of white space
				// const nonItemArea = thisMenuNonItemPrimitives.reduce((a, el)=>a+__el2Area(el), 0);
				// const itemArea = thisMenuItems.reduce((a, el)=>a+__el2Area(el), 0);
				// if(nonItemArea > (itemArea / 2)){
				// 	return false;
				// }
				// 2.1.4 - If menu items are <a>, most of them should not be external
				const anchorMenuEls = thisMenuItems.filter(menuItem=>menuItem.tagName.toLowerCase() === "a");
				if(anchorMenuEls.length > 1){ // else checking location makes no sense
					const minInternalAnchors = Math.ceil(anchorMenuEls.length * MIN_RATIO_INTERNAL_ANCHORS_MENU);
					const nInternAnch = anchorMenuEls.filter(el=>!__testIfLinkIsExternal(el, currBaseHost)).length;
					
					if(nInternAnch < minInternalAnchors){
						return false;
					}
				}
				// 2.2 - No non-button controls inside
				if(_nonBtnCntrls.some(x=>menuEl.contains(x))){
					return false;
				}
				// 2.3 - repetitive structure -- only upwards, because it can have nested folded items; b1) can have delimiters - so mostly repetitive structure
				const item2menuPaths = thisMenuItems.map(menuItemEl=>{
					const tags = [menuItemEl.parentElement.tagName]; // , menuItemEl.tagName <== sometimes menus items start from <a>, sometimes from <span> -- so not including 1st level
					var parent = menuItemEl.parentElement;
					while(parent !== menuEl){
						if(parent === null){
							debugger;
						}
						parent = parent.parentElement;
						tags.unshift(parent.tagName);
					}
					if(tags.length < 2){
						// putting the original tag back in -- we can't rely on a single element for comparison
						tags.push(menuItemEl.tagName);
					}
					return tags;
					// return tags.join("_");
				});
				// 2.3.1 - Test for pairwise matches -- most paths should be the same --> let's say all, but 1; unless we only 3 menuItems - then all should match
				// const maxNMatch = item2menuPaths.length * (item2menuPaths.length - 1);
				const minNMatchToQualify = (item2menuPaths.length > 3)?((item2menuPaths.length - 1) * (item2menuPaths.length - 2)): (item2menuPaths.length * (item2menuPaths.length - 1));
				const item2menuPathsStr = item2menuPaths.map(arr=>arr.join("_"));
				const pathMatchArr = item2menuPathsStr.map((pathStr, i)=>{
					return item2menuPathsStr.map((otherPathStr, otherI)=>{
						return (i !== otherI) && (pathStr === otherPathStr);
					});
				}).reduce((a, x)=>a.concat(x), []);
				const nPathMatch = pathMatchArr.reduce((a, bool)=>a+bool, 0);
				if(nPathMatch < minNMatchToQualify){
					return false;
				}
				return true;
			});
			// TODO test if we have nested menus - alert and keep only the outer ones <-- it can't be, since checking for repetitive structure would exclude outer menus <-- A bit too expensive --> Skip; We'll check for this when reviewing screenshots with Menu BBoxes
			// 3 - Classify menu
			const classifiedMenus = {
				v: [],
				h: [],
				mixed: []
			};
			// removing nested detected menus
			const nonNestMenuEls = window._filterOutNestedElements(menuEls);
			nonNestMenuEls.forEach(menuEl=>{
				// 3.1 - Get BBoxes of current menu items
				const thisMenuItemsBboxes = potentialMenuItemEls.filter(x=>menuEl.contains(x)).map(el=>el.getBoundingClientRect());
				// 3.2 - check if BBoxes have the same x or y coordinate
				const nPairwiseCmpSameX = __bboxCoordPairwiseCmpNMatch(thisMenuItemsBboxes, "x", 5);
				const nPairwiseCmpSameY = __bboxCoordPairwiseCmpNMatch(thisMenuItemsBboxes, "y", 5);
				// if all but one item are on the same line, we classify as vertical or horizontal --> otherwise mixed
				const _n = thisMenuItemsBboxes.length;
				const minNSameCoordToQualify = (_n > 3)?((_n - 1)*(_n - 2)):(_n*(_n - 1)); // <-- if it's only 3 items, all should be on the same line
				if(nPairwiseCmpSameX >= minNSameCoordToQualify){
					menuEl._menuType = "v";
					classifiedMenus.v.push(menuEl);
				}else if(nPairwiseCmpSameY >= minNSameCoordToQualify){
					menuEl._menuType = "h";
					classifiedMenus.h.push(menuEl);
				}else{
					// NOTE: this is the last line of defense against generous miscalssifications -- we won't have mixed menus; just presuming these aren't menus at all.
					// menuEl._menuType = "mixed";
					// classifiedMenus.mixed.push(menuEl);
				}
			});
			// 4 - Record Menu nestedness
			nonNestMenuEls.forEach(menuEl=>{
				const thisMenuItems = potentialMenuItemEls.filter(x=>menuEl.contains(x));
				const thisMenuAnchorEls = Array.from(menuEl.querySelectorAll("a"));
				const hiddenAnchorEls = thisMenuAnchorEls.filter(anchorEl=> !thisMenuItems.some(x=>anchorEl.isSameNode(x)));
				// if we have at least half as many hidden <a> as visible menuItems, it's a nested menu
				menuEl._isNested = (hiddenAnchorEls.length > thisMenuItems.length / 2);
				hiddenAnchorEls.forEach(el => el._hiddenAnchor = true);
				// menuEl._hiddenAnchors = hiddenAnchorEls;
				menuEl._sortedItems = window._sortElArrByDocOrder(thisMenuItems.concat(hiddenAnchorEls));
			});
			return classifiedMenus;
		});
	}
	
	function __bboxCoordPairwiseCmpNMatch(bboxArr, coord = "x", toleranceThr = 5){
		// to be used in menu detection -- for classifying menus as vertical or horizontal -- compares x or y coordinate of bboxes, pairwise
		return bboxArr.map((bbox, i)=>{
			return bboxArr.map((otherBBox, otherI)=>{
				if(i === otherI){
					return null;
				}
				return Math.abs(bbox[coord] - otherBBox[coord]) < toleranceThr;
			}).filter(el=>el!==null);
		}).reduce((a, x)=>a.concat(x), []).reduce((a, bool)=>a+bool, 0);
	}
	
	function __el2Area(el){
		// const bbox = el.getBoundingClientRect();
		const bbox = window._getFloatProofBBox(el);
		return bbox.width * bbox.height;
	}
	
	function __ancestorContainsOtherElsFromElArr(ancestorEl, targetEl, elArr){
		// to be used for menu detection -- when searching for a common ancestor - the one that contains at least one other "potentialMenuItem" <-- because menus are supposed to have several items in them.
		return elArr.some(el=>{
			console.assert(el !== ancestorEl, "A supposed menuItemPrimitive is a direct ancestor for another menuItemPrimitive, which shouldn't be --> debug. element: ", window.__el2stringForDiagnostics(el));
			if(el === ancestorEl){
				debugger;
			}
			return el !== targetEl && ancestorEl.contains(el);
		});
	}
	
	function getTitlesAsync(jqOverlays, jqMenus){
		var maybeTitleEls = window.domGetters.getTxtGr("allNoCntrl").toArray();
		// ATTENTION: "overlays" should already be defined - otherwise we'll have circular calls
		return window.domGetters.getOtherGrPromise("allPrimitives").then(jqAllPrimitives => {
			const primEls = jqAllPrimitives.add(window.domGetters.getAllVis().filter("iframe")).toArray();
			const overlEls = jqOverlays.toArray();
			const menuEls = jqMenus.toArray();
			maybeTitleEls = maybeTitleEls.filter(titleEl=>!menuEls.some(menuEl=>menuEl.contains(titleEl))); // titleEl is NOT contained in any menuEls
			// b) not a computed Cntrl
			const cmpCntrls = window.domGetters.getCntrlGr("computed").toArray();
			maybeTitleEls = maybeTitleEls.filter(titleEl=>!cmpCntrls.some(cmpCntrl=>cmpCntrl.contains(titleEl)));
			// c) not too long, but can be quite brief
			maybeTitleEls = maybeTitleEls.filter(titleEl=>window._getVisInnerTxt(titleEl).length < MAX_TITLE_LENGTH_CHAR);
			// d) Contains mostly text, not numbers
			maybeTitleEls = maybeTitleEls.filter(titleEl=>{
				const nNum = [...window._getVisInnerTxt(titleEl)].filter(isItDigit).length;
				return nNum < window._getVisInnerTxt(titleEl).length * MAX_TITLE_NUMBER2CHAR_RATIO;
			});
			// e) Above average font size
			const avgFontSize = _calcAvgFontSize(maybeTitleEls);
			maybeTitleEls = maybeTitleEls.filter(titleEl=>parseFloat(window.getComputedStyle(titleEl).fontSize) > avgFontSize);
			// f) look up until we reach display:block occupying 100% of a parent <-- because a title may contain several text nodes/pieces
			var blockTitleEls = [...new Set(maybeTitleEls.map(titleEl=>{
				var st = window.getComputedStyle(titleEl);
				// f.1) Looking for display:block
				while(titleEl !== null && st.display.indexOf("block") !== 0){
					titleEl = titleEl.parentElement;
					st = window.getComputedStyle(titleEl);
					// if we "cross" over/through an overlay in search of a blockParent, the starting el is not title
					if(overlEls.includes(titleEl)){
						return null;
					}
				}
				//NOTE: Not sure why I decided to compare title/container widths here <-- we detect a real container below -- move it there
				// // f.2) checking widths match
				// if(titleEl !== null){
				// 	const containerEl = titleEl.parentElement;
				// 	if(containerEl === null){
				// 		return null; // I doubt <body> could be a title
				// 	}
				// 	const contBBox = window._getInnerBBox(containerEl);
				// 	const titleBBox = window._getOuterBBox(titleEl);
				// 	// f.2.1) Let's try to avoid going out of overlays -- check that title's and parent's bboxes overlap
				// 	if(!window._do2bboxesOverlap(contBBox, titleBBox)){
				// 		return null;// OPTIMIZE: DO a better check, ensure titleEl is fully inside containerEl
				// 		// OPTIMIZE: This still doesn't fully exclude the chance of overlay "outstepping" - get overlay elements and see if we "cross" over any of them
				// 	}
				// 	if(titleBBox.width < contBBox.width * (1 - MAX_CONTAINER_TITLE_WIDTH_MISMATCH)){
				// 		// titleEl is too narrow, and doesn't occupy an entire line --> it's probably not a title
				// 		return null;
				// 	}
				// }
				return titleEl;
			}).filter(x=>x))];
			// g) Recursively look up through ancestors until: a) a title is no longer at the very top/above other primitives; b) it's no longer the largest + boldest text; c) there are primitives to the sides <-- If there are no other primitives/iframes in the ancestor, it's not a title -- A title is supposed to lead some content <== ALSO DETECTS sections -- no, not really; A section doesn't have to have a title, but a title needs a section to make sense, it can't exist in isolation
			// g) Search for a "body" for a title candiate
			return blockTitleEls.filter(blockTitleEl=>{
				// besides the same checks as for blockTitleSearch above
				var candidateSection = blockTitleEl; // needs to have 1) Other primitives; outside of the title; 2) Other texts being smaller than title; 3) Title being above all other primitives;
				var ifCrossedOverlay = false;
				while((candidateSection = candidateSection.parentElement) !== null && !ifCrossedOverlay){
					ifCrossedOverlay = overlEls.includes(candidateSection); // overlays themselves can be sections; but their parents can't
					// g.1) Look for other primitives in a potential section
					const otherSectionPrimitives = primEls.filter(primEl=>candidateSection.contains(primEl) && !blockTitleEl.contains(primEl));
					// if no other primitives, move up in the HTML tree, else more tests
					if(otherSectionPrimitives.length){
						// else, it's a potential section -- do other tests to definitively accept/reject it
						// g.2) checking widths match
						const contBBox = window._getInnerBBox(candidateSection);
						const titleBBox = window._getOuterBBox(blockTitleEl);
						// f.2.1) Let's try to avoid going out of overlays -- check that title's and parent's bboxes overlap
						if(!window._do2bboxesOverlap(contBBox, titleBBox)){
							return false;// OPTIMIZE: DO a better check, ensure titleEl is fully inside containerEl
							// OPTIMIZE: This still doesn't fully exclude the chance of overlay "outstepping" - get overlay elements and see if we "cross" over any of them
						}
						if(titleBBox.width < contBBox.width * (1 - MAX_CONTAINER_TITLE_WIDTH_MISMATCH)){
							// titleEl is too narrow, and doesn't occupy an entire line --> it's probably not a title
							return false;
						}
						// g.3) Other texts being smaller than title AND g.3) Title being above all other primitives
						const thisTitlePrims = primEls.filter(primEl=>blockTitleEl.contains(primEl));
						console.assert(thisTitlePrims.length, "We've just built blockTitleEl as containing at least 1 primitive, but now it has none?...", window.__el2stringForDiagnostics(blockTitleEl));
						return _isTitleFontLargerThanSectionFont(thisTitlePrims, otherSectionPrimitives) && _isTitleAboveOtherPrimitivesInASection(blockTitleEl, otherSectionPrimitives);
					}
				}
				return false; // we've traversed all the way up or through overlay, so not a title
			});
		});
	}
	
	function _isTitleAboveOtherPrimitivesInASection(titleEl, otherEls){
		// const tBBox = titleEl.getBoundingClientRect(); // we'll use the classical bbox - it doesn't really matter which one we use
		const tBBox = window._getFloatProofBBox(titleEl);
		const otherTxtEls = otherEls.filter(el=>window._getVisInnerTxt(el)); // NOTE: this is poor textEl detection -- we should rely on our collections, but do it here as a speed up -- hopefully not too many misclasification because of this
		// a - needs to be above all text elements
		const isAboveOtherTxt = otherTxtEls.every(txtEl=>{
			return tBBox.bottom <=  window._getFloatProofBBox(txtEl).top + 2; // a couple of pixels of flexibility
		});
		if(!isAboveOtherTxt){
			return false;
		}
		// b1 - if no otherTxtEls found, needs to be above all elements
		if(otherTxtEls.length === 0){
			const isAboveAll = otherEls.every(otherEl=>{
				return tBBox.bottom <=  window._getFloatProofBBox(otherEl).top + 2; // a couple of pixels of flexibility
			});
			if(!isAboveAll){
				return false;
			}
		}else{
			// b2 - Needs to be no lower than nonTxtEls
			const isNoLowerNonTxt = otherEls.filter(otherEl=>!otherTxtEls.includes(otherEl)).some(nTxtEl=>{
				return tBBox.top <= window._getFloatProofBBox(nTxtEl).top + 2;
			});
			if(!isNoLowerNonTxt){
				return false;
			}
		}
		return true;
	}
	
	function _isTitleFontLargerThanSectionFont(titleEls, otherEls){
		// get Title font props once
		// const tFontSize = parseFloat(st.fontSize);
		const tFontSize = _calcAvgFontSize(titleEls);
		const st = window.getComputedStyle(titleEls[0]);
		const fWeight = parseInt(st.fontWeight); // we'll just use the 1st one -- otherwise I don't know how to aggregate weight... The largest?...
		// check every other primitive element
		return otherEls.every(otherEl=>{
			if(!window.cleanString(window._getVisInnerTxt(otherEl)).length){
				return true; // not a text element, no need to compare fonts
			}
			const otherSt = window.getComputedStyle(otherEl);
			const otherFontSize = parseFloat(otherSt.fontSize);
			console.assert(!isNaN(otherFontSize) && !isNaN(tFontSize), "Couldn't parse font sizes", window.location.href);
			if(tFontSize > otherFontSize){
				return true;
			} else if(tFontSize === otherFontSize) {
				// compare boldness; boldness "makes" font seem slightly larger
				const otherFWeight = parseInt(otherSt.fontWeight);
				return fWeight > otherFWeight;
			}
			return false;
		});
	}
	
	window._semanticGroupDetectors = {
		getTitlesAsync: getTitlesAsync,
		getMenusAsync: getMenusAsync,
		findLogosAsync: findLogosAsync,
		findHeadersFootersAsync: findHeadersFootersAsync,
		findMainContentBlockAsync: findMainContentBlockAsync,
		findRotatingBannersAsync: findRotatingBannersAsync,
		findMainTxtChunksAsync: findMainTxtChunksAsync,
		findFormGroups: findFormGroups,
		findSocialButtonAreasAsync: findSocialButtonAreasAsync,
		findLoginAndSearchAreaAsync: findLoginAndSearchAreaAsync
	};
})();

undefined;
