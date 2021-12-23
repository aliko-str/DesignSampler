/* eslint-env browser */
/* global jQuery  */
/* global browser */

window.getPageVarData = function (pageVarsNeeded) {
	if (!pageVarsNeeded) {
		return Promise.resolve([]);
	}
	return new Promise(g2);
};

function g2(resolve, reject) {
	console.log("READABILITY FOR: ", window.location.hostname);
	// // const sep = "-";
	// // const mediaElements = window.___mediaElements;// = sep + ["img", "object", "video", "canvas", "embed", "picture", "svg"].join(sep) + sep;
	// const nonTextContentElements = [mediaElements, "keygen", "meter", "hr"].join(sep) + sep; // TO BE DROPPED -- only used in the current faulty white space estimation
	// const nonMainTextElements = sep + ["label", "output", "legend", "summary"].join(sep) + sep;
	// const controlElements = window.__elCollection.controls;
	// const headerElements = sep + ["header", "footer", "h1", "h2", "h3", "h4", "h5", "h6"].join(sep) + sep;
	// const listElements = sep + ["ul", "ol", "dl"].join(sep) + sep;
	// const allNonRegularTextElements = [controlElements, headerElements, "a"].join(sep) + sep;
	// const additSetsOfElements = {
	// 	headersNoFooters: sep + ["header", "h1", "h2", "h3", "h4", "h5", "h6"].join(sep) + sep,
	// 	nonMainBody: [controlElements, "footer", "a", nonMainTextElements].join(sep) + sep,
	// 	controlsAndLinks: [controlElements, "a"].join(sep) + sep,
	// 	nonMainBodyStrict: [controlElements, headerElements, "a", nonMainTextElements, nonTextContentElements].join(sep) + sep,
	// 	invisible: sep + ["map", "area"].join(sep) + sep
	// 	// TODO collect data-amounts for these
	// };

	const main = function () {
		// 0 - Preparations for data recording
		window.assingHiddenIdsAllEls();
		// 1 - Sample main texts for linguistic analyses
		const jqAllVisTexts = window.domGetters.getSemanticGrPrms("mainTxt");
		const sampleTexts = sampleMainTexts(jqAllVis);
		// "allNoCntrl"
		
		// 2 - Record text primites, their text, their origTag and some of the old computed properties
		const textAmounts = getAmountOfText(jqAllVisTexts);
		
		// 2.1 - Record column width only for the not-inline elements, or for their first non-inline ancestor <-- a separate table, a separate type of group
		
		// 3 - Record bbox for all real primities
		
		// 4 - Record computedStyles for all real primitives
		
		// 5 - Record bbox for all GROUPS
		
		// 6 - Record composition for all groups
		
		// 7 - Record page-level stats
		
		// TODO: don't forget to record the original tag of naked textNodes --- span._origElTag
		

		const txtGroups = createTextGroups(jqAllVis);
		
		// TODO: record all text properties for text Primitives
		// TODO: record all position/size/bgColor/ for all real primitives and computed controls
		
		// TODO: record group composition (and implicitly, their presence) <-- use ComputedControls as primitives <-- Filter out nested primitives (check if done already)
		
		// TODO: record whiteSpace (padding/margin) and borders for all groups, including controls
		
		// TODO: save all images
		
		// TODO: primitiveLevel: bbox, id, every computed property
		// TODO: primitiveLevel2: record "default" counterpart for every unique primitive element -- so we can compute the difference and see what's styled and how // TODO: create an F for this in dom.processing
		
		window.toggleDomPrepForInstaManip("on"); // TODO: move it to a proper place; ensure it's not on yte when recording primitive ComputedCSS props <== After primitives and their default counterparts have been saved
		
		// TODO: groupLevel (1, 2 and 2.1 -- computedControls, Semantic, HClust): composition; presence; bbox (also for wSpace estimation later on); screenshot (later on for color analyses); used borders; padding/margings within; 
		// TODO: pageLevel: whiteSpace, gridStructure (cell size and number), number of alignmentPoints, lengths, composition (presence/absence of elements/groups), borderUse, combined padding/margins, content distribution (as blackOut scramble?... or Clutter map/histogram later?... So we have types of, e.g., top-heavy pages)
		
		// TODO: replace white space measurement with padding/marging estimation -- page level
		
		
		
		getTextFeaturesInProportions(jqAllVis, function (allTextFeatures) {
			const jqMainText = window.__filterElements(jqAllVis, additSetsOfElements.nonMainBody, true);
			getTextFeaturesInProportions(jqMainText, function (mainTextFeatures) {
				// ======= NEW ADDITION ==========
				const jqAllControls = __filterElements(jqAllVis, additSetsOfElements.controlsAndLinks);
				getTextFeaturesInProportions(jqAllControls, function (controlElFeatures) {
					getImageParams(function (imageDataArr, imgAsBase64Arr, jqNonBgMediaArr) {
						const pageLevelM = pageLevelMeasures.getAllMeasurements(jqAllVis, jqMainText, jqAllControls);
						// resolve
						resolve([{
							textAmounts: textAmounts,
							txtGroups: txtGroups, // TODO: update from below
							allTextFeatures: allTextFeatures,
							mainTextFeatures: mainTextFeatures,
							controlElFeatures: controlElFeatures,
							imageDataArr: imageDataArr,
							pageLevelM: pageLevelM,
							sampleTexts: sampleTexts
						}, imgAsBase64Arr, jqNonBgMediaArr]);
					});
				});
				// ======= END NEW ADDITION =========
			});
		});
	};
	//// NEW ADDITION main text sampling ////////
	// function sampleMainTexts(jqAllVis) { // NOTE: we replace it with a SemanticGroup mainTxt
	// 	const minTextLength = 30; // characters
	// 	const jqCleanText = __filterElements(jqAllVis, additSetsOfElements.nonMainBodyStrict, true);
	// 	const results = [];
	// 	jqCleanText.each(function () {
	// 		var text = window._getFullTextCleanAllButSpaces(this);
	// 		if (text.length > minTextLength) {
	// 			results.push({
	// 				length: text.length,
	// 				text: text
	// 			});
	// 		}
	// 	});
	// 	return results;
	// }
	//// END NEW ADDITION main text sampling ////////


	//// NEW ADDITION OF IMAGE DATA colleciton ////////
	function getImageParams(cb) {
		const _jqAllVis = _getVisibleElements();
		// select all Media Elements
//		var jqAllMedia = _jqAllVis.filter(mediaElements.split("-").map(function (x) {
//			return x.trim();
//		}).filter(x => x).join(", ")); 
//		var jqAllMedia = __filterElements(_jqAllVis, mediaElements);
		var jqAllMedia = window.__filterElementsNoParentMatch(_jqAllVis, mediaElements);
		// filter out all nested media elements
//		jqAllMedia = $(window._filterOutNestedElements(jqAllMedia.toArray()));
		// add all elements with Background Images -- Note: we avoid also the elements nested in AllMedia
		const _jqRest = __filterElements(_jqAllVis, mediaElements, true);
		var jqBackImg = _jqRest.filter(function () {
			return (window.getComputedStyle(this)["background-image"].toLowerCase().indexOf("url") !== -1);
		});
		// We should detach visible Overlays from DOM when screenshotting Backgrounds - otherwise we often have sticky elements in them
		const _jqOverlays = window._findOverlays(_jqAllVis);
		window._getOnlyRealImg(jqBackImg, function (jqBackImg) {
			// AGAIN: filter out all nested media elements <-- no, we'll just make the content invisible
			// jqBackImg = $(window._filterOutNestedElements(jqBackImg.toArray()));
//			jqAllMedia = jqAllMedia.add(jqBackImg);
//			// filter out images that are overlaid // The F didn't work properly -- too complex to make work --> just accept the hopefully-tolerable data-error consequences
//			jqAllMedia = jqAllMedia.filter(function () {
//				return window._checkZIndexVisibility(this);
//			});
			// for each element, get their position/size and send to the addon
			//var _syncObj = jqAllMedia.length;
			const results = [];
			const imgAsBase64Arr = [];
			const jqNonBgMediaArr = [];
			jqAllMedia.toArray().reduce((p, aJqEl) => {
				// make it sequential -- we can't do it in parallel
				return p.then(()=>{
					return oneByOne(aJqEl, false);
				});
			}, Promise.resolve()).then(()=>{
				return jqBackImg.toArray().reduce((p, aJqEl)=>{
					return p.then(()=>{
						return oneByOne(aJqEl, true);
					});
				}, Promise.resolve());
			}).then(()=>{
				cb(results, imgAsBase64Arr, jqNonBgMediaArr);
			});
			
			const oneByOne = function (aJqEl, ifBgEl = false) {
				return new Promise((resolve, reject)=>{
					const b = window._getAbsBoundingRectAdjForParentOverflow(aJqEl);
					b.el = aJqEl.tagName.toLowerCase();
					// check if the background image is repeated - if not, reduce the box down to Min(icon size, element size)
					// TODO: switch from noop to a real F
					window._getNonRepeatedBgImgSizeNoOp(aJqEl, function (sizes) {
						if (b.width < 1 || b.height < 1) {
							// zero-size object to screenshot --> skipping it (some invisible iframe or smth similar)
							return resolve();
						}
						const canvas = window.el2canvasWhiteBgNoOverlays(aJqEl, b, ifBgEl, _jqOverlays);
	//						const canvas = window.screenPart2Canvas(b);
	//						const canvas = window._el2canvasWhiteBG(aJqEl, b);
						var imgType;
						if (b.width * b.height < 2) {
							imgType = "pxl"; // checking for a bg pixel here - we can't estimate SD for fewer than 2 datapoints
						} else {
							const imgPixSd = window.__calcSD(canvas.getContext("2d").getImageData(0, 0, b.width, b.height).data);
							imgType = window.__isItUI(b) ? "ui" : window.__isItIcon(b) ? "icon" :(imgPixSd < 10) ? "bg" : "main"; // NOTE: we already filter out many bg images in window._getNonRepeatedBgImgSize	
						}
						const imgName = [b.top, b.left, b.width, b.height, b.el, "id" + Math.round(Math.random() * 100000), imgType].join("_");
						imgAsBase64Arr.push({
							name: imgName,
							dat: canvas.toDataURL().replace(/^data:image\/png;base64,/, "")
						});
						if (imgType === "main") {
							jqNonBgMediaArr.push(aJqEl);
						}
						window.getImgFSizes(canvas).then((sizes) => {
							//							sizes.areaSize = Math.round(b.height*b.width*100)/100; // I have no idea why I did this Round...
							sizes.areaSize = b.width * b.height;
							sizes.id = imgName;
							sizes.imgType = imgType;
							results.push(sizes);
							resolve();
						});
					});					
				});
			};
		});
	}
	//// END ----  NEW ADDITION OF IMAGE DATA colleciton ////////

	function _getVisibleElements() {
		return window._getVisibleElements();
	}
	
	// function __getTextContent(el) { // Only the text of immediate textNode children is returned
	// 	var textContent = "";
	// 	if (el.nodeType === 3) {
	// 		textContent = window.cleanString(el.textContent);
	// 	} else {
	// 		for (var i = el.childNodes.length; i--;) {
	// 			const subEl = el.childNodes[i];
	// 			if (subEl.nodeType === 3) {
	// 				textContent += window.cleanString(subEl.textContent);
	// 			}
	// 		}
	// 	}
	// 	return textContent;
	// }

	// function _buildTextResults(name, allTextLength, jqEls) {
	// 	//(new Array(jqEls)).
	// 	var allText = [];
	// 	for (var i = jqEls.length; i--;) {
	// 		// allText.push(__getTextContent(jqEls[i]));
	// 		allText.push(window._getFullTextCleanAllButSpaces(jqEls[i]));
	// 	}
	// 	allText = allText.join("");
	// 	return {
	// 		name: name,
	// 		length: allText.length,
	// 		count: jqEls.length,
	// 		ratio: allTextLength?allText.length / allTextLength:0,
	// 		text: allText
	// 	};
	// }
	function createTextGroups(jqAllVis){
		const groups = {
			"controls": {tags: controlElements, inv: false},
			"links": {tags: "-a-", inv: false},
			"linksAndControls": {tags: additSetsOfElements.controlsAndLinks, inv: false},
			"headers": {tags: headerElements, inv: false},
			"headersNofooters": {tags: additSetsOfElements.headersNoFooters, inv: false},
			"mainbodytext": {tags: additSetsOfElements.nonMainBody, inv: true},
			"bullets": {tags: listElements, inv: false}
		};
		return _classifyEls(jqAllVis, groups);
		
		// // per-type results
		// // all text
		// perType.push(_buildTextResults("all", allTextLength, jqAllVis));
		// // text in buttons/controls
		// const jqControls = __filterElements(jqAllVis, controlElements);
		// perType.push(_buildTextResults("controls", allTextLength, jqControls));
		// // text in links
		// const jqLinks = __filterElements(jqAllVis, "-a-");
		// perType.push(_buildTextResults("links", allTextLength, jqLinks));
		// // text in links and controls
		// const jqLinksAndControls = __filterElements(jqAllVis, additSetsOfElements.controlsAndLinks);
		// perType.push(_buildTextResults("linksAndControls", allTextLength, jqLinksAndControls));
		// // text in headers
		// const jqHeaders = __filterElements(jqAllVis, headerElements);
		// perType.push(_buildTextResults("headers", allTextLength, jqHeaders));
		// // text in headers, no footers
		// const jqHeadersNoFooters = __filterElements(jqAllVis, additSetsOfElements.headersNoFooters);
		// perType.push(_buildTextResults("headersNofooters", allTextLength, jqHeadersNoFooters));
		// // main text (i.e., the rest)
		// const jqRestOfText = __filterElements(jqAllVis, additSetsOfElements.nonMainBody, true);
		// perType.push(_buildTextResults("mainbodytext", allTextLength, jqRestOfText));
		// // all list texts
		// const jqListEls = __filterElements(jqAllVis, listElements);
		// perType.push(_buildTextResults("bullets", allTextLength, jqListEls));
		// return {
		// 	all: all,
		// 	perType: perType
		// };
	}
	
	function _classifyEls(jqAll, elGroups = {}){ // simple classification, based on tags only
		const res = {};
		Object.keys(elGroups).map(groupName=>{
			const group = elGroups[groupName];
			console.assert(res[groupName] === undefined, "Group", groupName, "has already been initialized");
			const jqGroupArr = window.__filterElements(jqAll, group.tags, group.inv).toArray();
			res[groupName] = jqGroupArr.map(el=>{
				return {
					tagName: el.tagName,
					id: window._getElId(el)
				};
			});
		});
		return res;
	}

	function getAmountOfText(jqAllVis) {
		// const perType = [];
		// var allTextLength = 0;
		// all per-element results
		const all = jqAllVis.toArray().map(function (el) {
			const elTxt = window._getFullTextCleanAllButSpaces(el);
			// allTextLength += elTxt.length;
			return {
				tagName: el.tagName,
				length: elTxt.length,
				text: elTxt,
				id: window._getElId(el)
			};
		});
		return all;
	}

	// NEW ================== ADDITIONAL measuresment ==============================

	const pageLevelMeasures = {
		_measureWhiteSpace: function (jqEls) {
			// NOTICE: This F makes no sense because of a) margin collapsing, and b) other ways of creating white space, like positioning ==> Measure white space only for the entire page as pageSize-contentSize
			// Repeat 3 times: for all elements; for all elements with, for all main text elements
			var accuSize = 0;
			var accuWhite = 0;
			jqEls.each(function () { // NOTE: We should correct for margin collapsing
				const realSize = this.clientHeight * this.clientWidth;
				const sizesWithMarg = this.getBoundingClientRect();
				const styles = window.getComputedStyle(this);
				const props = {};
				props["marTop"] = parseFloat(styles["margin-top"].replace("px", ""));
				props["marBot"] = parseFloat(styles["margin-bottom"].replace("px", ""));
				props["marLef"] = parseFloat(styles["margin-left"].replace("px", ""));
				props["marRig"] = parseFloat(styles["margin-right"].replace("px", ""));
				Object.keys(props).forEach(function (el) {
					if (isNaN(props[el])) {
						console.error("NaN while parsing margins for", props, "value:", el);
					}
					props[el] = 0;
				});

				const fullHeight = sizesWithMarg.height + props.marTop + props.marBot;
				const fullWidth = sizesWithMarg.width + props.marLef + props.marRig;

				accuSize += realSize;
				accuWhite += ((fullHeight * fullWidth) - realSize);
			});
			return {
				size: accuSize,
				white: accuWhite
			};
		},
		_measurePageDims: function () {
			return {
				pageHeight: document.documentElement.scrollHeight,
				pageWidth: document.documentElement.scrollWidth
			}; // this doesn't appear fully precise, but close enough for most documents, and measured the same way for all pages...
		},
		_measureElemSize: function (jqEls) {
			return jqEls.toArray().reduce((acc, el) => acc += el.clientHeight * el.clientWidth, 0);
		},
		getAllMeasurements: function (jqAllVis, jqMainText, jqAllControls) {
			const jqAllRealVis = _getVisibleElements();
			const results = {};
			var t = this._measureWhiteSpace(jqAllRealVis);
			results["whiteAllAll"] = t.white;
			results["sizeAllAll"] = t.size;
			t = this._measureWhiteSpace(jqAllVis);
			results["whiteAllText"] = t.white; // makes no sense - parent padding isn't accounted for
			results["sizeAllText"] = t.size;
			t = this._measureWhiteSpace(jqMainText);
			results["whiteMainText"] = t.white;
			results["sizeMainText"] = t.size;
			t = this._measureWhiteSpace(jqAllControls);
			results["whiteControls"] = t.white;
			results["sizeControls"] = t.size;

			const jqAllNonTextControls = __filterElements(jqAllRealVis, nonTextContentElements);
			results["realSizeAll"] = this._measureElemSize(jqAllVis.add(jqAllNonTextControls));

			results["whiteRatio"] = results["whiteAllAll"] / results["realSizeAll"];
			Object.assign(results, this._measurePageDims());
			return results;
		}
	};

	function _recordEachBoundingBox(allTextLength, jqEls) {
		const results = [];
		jqEls.each(function () {
//			const sizes = this.getBoundingClientRect();
//			const cumulOffset = window._cumulativeOffset(this);
//			const styles = window.getComputedStyle(this);
//			const props = {};
//			props["padTop"] = parseFloat(styles["padding-top"].replace("px", ""));
//			props["padBot"] = parseFloat(styles["padding-bottom"].replace("px", ""));
//			props["padLef"] = parseFloat(styles["padding-left"].replace("px", ""));
//			props["padRig"] = parseFloat(styles["padding-right"].replace("px", ""));
//
//			props["borTop"] = parseInt(styles["border-top-width"].replace("px", ""), 10);
//			props["borBot"] = parseInt(styles["border-bottom-width"].replace("px", ""), 10);
//			props["borLef"] = parseInt(styles["border-left-width"].replace("px", ""), 10);
//			props["borRig"] = parseInt(styles["border-right-width"].replace("px", ""), 10);
//
//			Object.keys(props).forEach(function (el) {
//				if (isNaN(props[el])) {
//					console.log("NaN", props.join(", "));
//				}
//				props[el] = 0;
//			});

			const innerBBox = window._getInnerBBox(this);
			const _res = _buildTextResults(this.tagName, allTextLength, $(this));

//			_res.topX = (cumulOffset.top) + props.padTop + props.borTop;
//			_res.lefY = (cumulOffset.left) + props.padLef + props.borLef;
//			_res.botX = (sizes.height + cumulOffset.top) - props.padBot - props.borBot;
//			_res.rigY = (sizes.width + cumulOffset.left) - props.padRig - props.borRig;
			results.push(Object.assign(_res, innerBBox));
		});
		return results;
	}

	// END NEW ================== ADDITIONAL measuresment ==============================

	function _measureTextStyle(allTextLength, jqEls) {
		const results = [];
		// thin font
		const jqThin = jqEls.filter(function () {
			const styles = window.getComputedStyle(this);
			var fontWeight = parseInt(styles["fontWeight"], 10);
			if (!isNaN(fontWeight)) {
				if (fontWeight < 400) {
					return true;
				}
			} else if (styles["fontWeight"] == "lighter") {
				return true;
			}
			return false;
		});
		results.push(_buildTextResults("thin", allTextLength, jqThin));
		// BOLD
		const jqBold = jqEls.filter(function () {
			const styles = window.getComputedStyle(this);
			var fontWeight = parseInt(styles["fontWeight"], 10);
			if (!isNaN(fontWeight)) {
				if (fontWeight > 400) {
					return true;
				}
			} else if (styles["fontWeight"] == "bold" || styles["fontWeight"] == "bolder") {
				return true;
			}
			return false;
		});
		results.push(_buildTextResults("bold", allTextLength, jqBold));
		// Underline
		const jqUnderline = jqEls.filter(function () {
			const textDecor = window.getComputedStyle(this)["textDecoration"];
			return (textDecor == "underline" || textDecor == "overline" || textDecor == "line-through");
		});
		results.push(_buildTextResults("underline", allTextLength, jqUnderline));
		// Italic
		const jqItalic = jqEls.filter(function () {
			const fontStyle = window.getComputedStyle(this)["fontStyle"];
			return (fontStyle == "italic" || fontStyle == "oblique");
		});
		results.push(_buildTextResults("italic", allTextLength, jqItalic));
		return results;
	}

	function _measureFontSizes(allTextLength, jqEls) {
		const results = [];
		////////////// Font Sizes  //////////////
		function _getFontSize(el) {
			var fontStyle = window.getComputedStyle(el)["fontSize"];
			const fontStyleInt = parseInt(fontStyle.replace("px", ""), 10);
			if (isNaN(fontStyleInt)) {
				console.error("Couldn't parse font size: " + fontStyle);
				return null;
			}
			return fontStyleInt;
		}
		// FONT SIZE: < 6
		const jqTinyFont = jqEls.filter(function () {
			const fontSize = _getFontSize(this);
			return (fontSize !== null && fontSize < 6);
		});
		results.push(_buildTextResults("tinyfont", allTextLength, jqTinyFont));

		// FONT SIZE: >= 6 and <= 52
		const _minF = 6;
		const _maxF = 52;
		for (var i = _minF; i <= 52; i++) {
			const jqFontSize = jqEls.filter(function () {
				const fontSize = _getFontSize(this);
				return (fontSize !== null && fontSize == i);
			});
			results.push(_buildTextResults("fontsize_" + i, allTextLength, jqFontSize));
		}
		// FONT SIZE:  > 52
		const jqGiantFont = jqEls.filter(function () {
			const fontSize = _getFontSize(this);
			return (fontSize !== null && fontSize > 52);
		});
		results.push(_buildTextResults("giantfont", allTextLength, jqGiantFont));
		return results;
	}

	function _measureLineSpacing(allTextLength, jqEls) {
		// Font Sizes * Line height
		// CONSIDER ratio of font size to line height
		const results = [];
		const jqElsByLineSpacing = _categorizeElsLineHeight(jqEls);
		for (var i = 0, _keys = Object.keys(jqElsByLineSpacing), ilen = _keys.length; i < ilen; i++) {
			results.push(_buildTextResults(_keys[i], allTextLength, jqElsByLineSpacing[_keys[i]]));
		}
		return results;
	}

	function _measureFontFamily(allTextLength, jqEls) {
		const results = [];
		const jqElsByFontFamily = _categorizeElsByFontFamily(jqEls);
		for (var i = 0, _keys = Object.keys(jqElsByFontFamily), ilen = _keys.length; i < ilen; i++) {
			results.push(_buildTextResults("fontfamily_" + _keys[i].replace(",", "+"), allTextLength, jqElsByFontFamily[_keys[i]]));
		}
		return results;
	}

	function _categorizeElsByFontFamily(jqAllEls) {
		var jqElsByFontFamily = {};
		for (var i = 0, ilen = jqAllEls.length; i < ilen; i++) {
			const aFont = window.getComputedStyle(jqAllEls[i])["fontFamily"];
			if (!jqElsByFontFamily[aFont]) {
				jqElsByFontFamily[aFont] = [];
			}
			jqElsByFontFamily[aFont].push(jqAllEls[i]);
		}
		__diagnoseCSSFeatureCoverage("fontFamily", jqAllEls, jqElsByFontFamily, "fontFamily");
		return jqElsByFontFamily;
	}

	function _categorizeElsLineHeight(jqAllEls) {
		var jqElsByLineSpacing = {};
		const _minRatio = -0.5;
		const _maxRatio = 2.5;
		const _stepRatio = 0.1;

		function getRatioOneEl(self) {
			const aStyleSet = window.getComputedStyle(self);
			var thisLineHeight = parseFloat(aStyleSet["lineHeight"]); //.replace("px", "")
			const thisFontSize = parseFloat(aStyleSet["fontSize"]); //.replace("px", "")
			if(isNaN(thisFontSize)){
				console.error("NaNs are produced, font size: ", aStyleSet["fontSize"]);
				return false;
			}
			if (isNaN(thisLineHeight)) {
				// line-height being "normal" instead of a number is an issue of new FF --> take the parents one
				thisLineHeight = parseFloat(window.getComputedStyle(self.parentElement)["lineHeight"]); // we don't have to replace px: .replace("px", "")
				if(isNaN(thisLineHeight)){
					console.warn("NaNs are produced, even for the parent, lineHeight: ", aStyleSet["lineHeight"]);
					return false;
				}
			}
			return (thisLineHeight - thisFontSize) / thisFontSize;
		}
		for (var i = _minRatio; i <= _maxRatio + _stepRatio; i += _stepRatio) {
			const iFixed = i.toFixed(2);
			jqElsByLineSpacing["linespacing_" + iFixed] = jqAllEls.filter(function () {
				const lineFontRatio = getRatioOneEl(this);
				return (lineFontRatio > (iFixed - _stepRatio).toFixed(2) && lineFontRatio <= iFixed);
			});
		}
		// fringe cases: below -0.5 and above 2.5
		jqElsByLineSpacing["linespacing_less" + (_minRatio - _stepRatio).toFixed(2)] = jqAllEls.filter(function () {
			const lineFontRatio = getRatioOneEl(this);
			return (lineFontRatio <= (_minRatio - _stepRatio).toFixed(2));
		});
		jqElsByLineSpacing["linespacing_more" + _maxRatio] = jqAllEls.filter(function () {
			const lineFontRatio = getRatioOneEl(this);
			return (lineFontRatio > _maxRatio);
		});
		__diagnoseCSSFeatureCoverage("linespacing", jqAllEls, jqElsByLineSpacing, ["lineHeight", "fontSize"]);
		return jqElsByLineSpacing;
	}

	function _genericResultBuilder(allTextLength, jqEls) {
		const results = [];
		for (var i = 0, _keys = Object.keys(jqEls), ilen = _keys.length; i < ilen; i++) {
			results.push(_buildTextResults(_keys[i], allTextLength, jqEls[_keys[i]]));
		}
		return results;
	}

	function _measureTextAlign(allTextLength, jqEls) {
		const results = [];
		const __getTextAlignType = function (jqEls, condF) {
			return jqEls.filter(function () {
				const styles = window.getComputedStyle(this);
				return condF(styles["textAlign"].replace("-moz-", ""), styles);
			});
		};
		const leftyEls = __getTextAlignType(jqEls, function (alignVal, styles) {
			return ((alignVal == "left") || (alignVal == "start" && styles["direction"] == "ltr") || (alignVal == "end" && styles["direction"] == "rtl"));
		});
		results.push(_buildTextResults("textalign_" + "left", allTextLength, leftyEls));

		const rightyEls = __getTextAlignType(jqEls, function (alignVal, styles) {
			return ((alignVal == "right") || (alignVal == "start" && styles["direction"] == "rtl") || (alignVal == "end" && styles["direction"] == "ltr"));
		});
		results.push(_buildTextResults("textalign_" + "right", allTextLength, rightyEls));

		const centryEls = __getTextAlignType(jqEls, function (alignVal) {
			return (alignVal == "center");
		});
		results.push(_buildTextResults("textalign_" + "center", allTextLength, centryEls));

		const justyEls = __getTextAlignType(jqEls, function (alignVal) {
			return (alignVal.indexOf("justify") > -1);
		});
		results.push(_buildTextResults("textalign_" + "justify", allTextLength, justyEls));

		__diagnoseCSSFeatureCoverage("textAlign", jqEls, [leftyEls, rightyEls, centryEls, justyEls], "textAlign");
		return results;
	}

	function __diagnoseCSSFeatureCoverage(cssFeature, jqAllEls, arrJqSelectedEls, cssFeatureName) {
		if (!$.isArray(arrJqSelectedEls)) {
			arrJqSelectedEls = Object.keys(arrJqSelectedEls).map(function (el, i) {
				return arrJqSelectedEls[el];
			});
		}
		const diff = jqAllEls.length - arrJqSelectedEls.reduce(function (pVal, el, i) {
			return pVal + el.length;
		}, 0);
		if (diff) {
			console.log("Diagnosed Feature: ", cssFeature, " DIFF. between num of all elements and processed elements: ", diff);
			if (Object.prototype.toString.call(cssFeatureName) == '[object String]') {
				cssFeatureName = [cssFeatureName];
			}
			const accountedItems = [];
			const unaccountedItems = [];
			for (var iarr = arrJqSelectedEls.length; iarr--;) {
				var anArr = arrJqSelectedEls[iarr];
				anArr.toArray && (anArr = anArr.toArray());
				anArr.filter(function (el, i) {
					for (var iJqEl = jqAllEls.length; iJqEl--;) {
						if (jqAllEls[iJqEl] == el) {
							accountedItems[iJqEl] = 1;
							return false;
						}
					}
					return true;
				});
			}
			for (var i = jqAllEls.length; i--;) {
				if (!accountedItems[i]) {
					unaccountedItems.push(jqAllEls[i]);
				}
			}
			if (unaccountedItems && unaccountedItems.length) {
				unaccountedItems.forEach(function (el, i) {
					var style1 = window.getComputedStyle(el);
					for (var i = cssFeatureName.length; i--;) {
						const aFeature = cssFeatureName[i];
						console.log("UNaccounted value of ", aFeature, " == ", style1[aFeature]);
					}
				});
			}
		}
	}

	function _measureTextWidth(allTextLength, jqEls) {
		// sort elements in categories
		var jqElCats = {};
		for (var i = jqEls.length; i--;) {
			// 1 - width in pixels
			var el = jqEls[i];
			var widthPix = window.getComputedStyle(el)["width"].replace("px", "");
			var catName = "widthpix_" + widthPix;
			if (!jqElCats[catName]) {
				jqElCats[catName] = [];
			}
			jqElCats[catName].push(el);
		}
		return _genericResultBuilder(allTextLength, jqElCats);
	}

	function _measureTextWidthChar_Sync(allTextLength, jqEls) {
		var jqElCatsChar = {};
		for (var i = jqEls.length; i--;) {
			// 2 - width in characters
			var el = jqEls[i];
			var widthChar = window._textWidthInCharacters(el);
			var catNameChar = "widthchar_" + widthChar;
			if (!jqElCatsChar[catNameChar]) {
				jqElCatsChar[catNameChar] = [];
			}
			jqElCatsChar[catNameChar].push(el);
		}
		return _genericResultBuilder(allTextLength, jqElCatsChar);
	}

	function _measureTextWidthChar(allTextLength, jqEls, cb) {
		var jqElCatsChar = {};
		//var counter = jqEls.length;
		function wrapperAroundTextWidthCounter(counter) {
			// 1  - Check if all done
			if (!counter) {
				// console.log("DONE measuring text width");
				return cb(_genericResultBuilder(allTextLength, jqElCatsChar));
			}
			// 2 - actually measure width in characters
			// 2.1 - Context switching is expensive - do in batches of 25
			var ilast = Math.max(counter - 1 - 25, 0);
			for (var i = counter - 1; i >= ilast; i--) {
				var el = jqEls[i];
				var widthChar = window._textWidthInCharacters(el);
				var catNameChar = "widthchar_" + widthChar;
				if (!jqElCatsChar[catNameChar]) {
					jqElCatsChar[catNameChar] = [];
				}
				jqElCatsChar[catNameChar].push(el);
			}
			// 3 - Repeat
			window.setTimeout(function () {
				wrapperAroundTextWidthCounter(ilast);
			}, 1);
		}
		wrapperAroundTextWidthCounter(jqEls.length);
		// return _genericResultBuilder(allTextLength, jqElCatsChar);
	}

	function _measureWordSpacing(allTextLength, jqEls) {
		const results = [];
		const _minSpacing = -5;
		const _maxSpacing = 50;
		const __getWordSpacing = function (jqEls, condF) {
			return jqEls.filter(function () {
				const styles = window.getComputedStyle(this);
				const spacing = parseInt(styles["wordSpacing"].replace("px", ""), 10);
				if (isNaN(spacing)) {
					console.error("Spacing is NaN. Actual value: ", styles["wordSpacing"]);
				}
				return condF(spacing);
			});
		};
		for (var i = _minSpacing; i <= _maxSpacing; i++) {
			var aRes = _buildTextResults("wordspacing_" + i.toFixed(1), allTextLength, __getWordSpacing(jqEls, function (spacing) {
				return spacing == i;
			}));
			results.push(aRes);
		}
		results.push(_buildTextResults("wordspacing_lessthan_" + _minSpacing, allTextLength, __getWordSpacing(jqEls, function (spacing) {
			return spacing < _minSpacing;
		})));
		results.push(_buildTextResults("wordspacing_morethan_" + _maxSpacing, allTextLength, __getWordSpacing(jqEls, function (spacing) {
			return spacing > _maxSpacing;
		})));
		return results;
	}
	// paddings/margins - to measure empty space and distance between elements. <--
	// bad measure of empty space -- many more ways to create empty space exist.

	function getTextFeaturesInProportions(jqEls, cb) {
		const results = {};
		var allTextLength = 0;
		var all = jqEls.each(function (i, el) {
			allTextLength += __getTextContent(this).length; // TODO: replace with window._getFullTextCleanAllButSpaces
		});
		if (!jqEls.length) {
			return cb(results);
		}
		results["textstyle"] = _measureTextStyle(allTextLength, jqEls);
		results["fontsizes"] = _measureFontSizes(allTextLength, jqEls);
		results["fonttypes"] = _measureFontFamily(allTextLength, jqEls);
		results["linespacing"] = _measureLineSpacing(allTextLength, jqEls);
		results["textalign"] = _measureTextAlign(allTextLength, jqEls);
		results["wordspacing"] = _measureWordSpacing(allTextLength, jqEls);
		results["widthpix"] = _measureTextWidth(allTextLength, jqEls);
		results["widthchar"] = _measureTextWidthChar_Sync(allTextLength, jqEls); // <-- we'll keep it sync - otherwise context switching takes way too long


		results["boundbox"] = _recordEachBoundingBox(allTextLength, jqEls);

		// Text-Background color combinations
		window._categorizeColorContrast(allTextLength, jqEls, function (contrastEls) {
			results["colordiff"] = _genericResultBuilder(allTextLength, contrastEls.jqElColorDiff);
			results["lumcontr"] = _genericResultBuilder(allTextLength, contrastEls.jqElLumContr);
			results["colbgpair"] = _genericResultBuilder(allTextLength, contrastEls.jqElColBg);
			// Text Width <== Disable the async version -- apparently context switching takes way too long...
			// _measureTextWidthChar(allTextLength, jqEls, function(widthcharArr){
			// results["widthchar"] = widthcharArr;
			// cb(results);
			// });
			cb(results);
		});
		return undefined;
	}

	return main();
};

undefined;
