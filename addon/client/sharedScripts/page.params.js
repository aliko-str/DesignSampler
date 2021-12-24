/* eslint-env browser */
/* global jQuery  */
/* global browser */

(function(){
	const ciceroText = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"; // used in checking if a node has pre-defined width/height

	function getPageVarData(pageVarsNeeded, thisIframeIsAWidget, thisIsIframe = false) {
		if (!pageVarsNeeded) {
			return Promise.resolve({});
		}
		return main(thisIframeIsAWidget, thisIsIframe); // returns a Promise
	};

	function main(thisIframeIsAWidget, thisIsIframe) {
		console.log("READABILITY FOR: ", window.location.hostname);
		// Some setting up - what semantic groups need recording
		var semGrNamesToRecord = ['titles', 'headers', 'footers', 'socialButtons', 'menusV', 'menusH', 'menusMixed', 'funcAreas', 'logos', 'overlays', 'forms', 'rotatingBanners', 'mainBody', 'mainTxtChunksArr', 'fixedAreas'];
		if(thisIframeIsAWidget){
			// some groups make no sense for widgets -- also because they are estimated based on a proportion of document size
			semGrNamesToRecord = ['titles', 'menusV', 'menusH', 'menusMixed', 'overlays', 'forms', 'rotatingBanners', 'mainTxtChunksArr'];
		}
		const resDataObj = {
			data: { // to be converted in dataTables // TOD): save paraRes2Save as a data tabTables
				sampledMainTxtParagraphs: null,
				txtPrimitivesOldData: null,
				paragraphsData: null,
				allPrimitivesTypeBBox: null,
				allPrimitivesCmpStyles: null,
				allPrimitivesCmpStylesNoStyling: null,
				links: null,
				borderEls: null,
				bgChangeEls: null,
				semanticGroupProps: null,
				menuData: null,
				bannerHiddImgData: null,
				socialAreaData: null,
				funcAreaData: null,
				fixedAreaData: null
			},
			groups: { // to record group memberships
				paragraphs: null // save paraAsCollOfNodes as a membership table
			}
		};
		const screenshotsToSave = {
			debug: {
				paragraphsCnvs: null // canvases <-- require window.__cnvs2DataUrl to be saved
			},
			groups: { // unfortunate naming -- it contains arrays of screenshots, and not just screenshots of groups
				graphics: [], // [{name:string, dat:base64}]
				bannerHiddImg: []
			}
		};
		// 0 - Preparations for data recording
		window.toggleDomPrepForInstaManip("on", {refresh: true}); // TODO: move it to a proper place; ensure it's not on yte when recording primitive ComputedCSS props <== After primitives and their default counterparts have been saved
		// 1 - Sample main texts for linguistic analyses
		// NOTE: it's a bit wonky, but we need to request a semantic group before we do other processing - because it's a group that triggers initialization for all other groups and includes a post-initialization step 
		const pr1 = window.domGetters.getSemanticGrPrms("mainTxtChunksArr").then((elsMainTxt)=>{
			resDataObj.data.sampledMainTxtParagraphs = sampleMainTexts(elsMainTxt); // NOTE: this is in addition to later recording mainTxt as groups
		});
		// 2 - Record text primites, their text, their origTag and some of the old computed properties
		const pr2 = pr1.then(()=>{
			return getTextsAndOldStylesAsync(window.domGetters.getTxtGr("all")).then(txtPrimitivesOldData=>{
				resDataObj.data.txtPrimitivesOldData = txtPrimitivesOldData;
			});
		});
		// 3 - Record paragraphs
		const pr3 = pr2.then(()=>{
			const jqElsToSplitInPara = window.domGetters.getTxtGr("allNoCntrlNoCompCntrl");
			// TODO: remove computed controls from jqElsToSplitInPara
			const {paraAsCollOfNodes, paraRes2Save} = sortTxtNodesInMultiLineParagraphs(jqElsToSplitInPara);
			resDataObj.data.paragraphsData = paraRes2Save;
			resDataObj.groups.paragraphs = paraAsCollOfNodes; // __membership2TabTable(paraAsCollOfNodes);
			// save an img for debug of paragraphs
			// const origPageCnvs = window.page2Canvas(true);
			const origPageCnvs = window.getStoredFullPageCanvas();
			screenshotsToSave.debug.paragraphsCnvs = window.highlightRectsOnCnvs(origPageCnvs, paraRes2Save); // .map(x=>x.bbox)
		});
		// NOTE: we don't save actual BG color for each primitive <== it ONLY makes sense for text (to calc contrast) -- we also later save it for groups
		// 3.1 - Record column width only for the not-inline elements, or for their first non-inline ancestor <-- a separate table, a separate type of group <== WE DO THAT for paragraphs; we can't do better
		// 4 - Record bbox, tagName, and type for all real primities + All Computed Properties
		const pr4 = pr3.then(()=>{
			const jqTxt = window.domGetters.getTxtGr("allNoCntrl");
			const jqCntrAcr = window.domGetters.getCntrlGr("actionable");
			const jqCntrDecor = window.domGetters.getCntrlGr("decorative");
			return window.domGetters.getGraphGrPromise("allNonBgBg").then(jqGrColl=>{
				resDataObj.data.allPrimitivesTypeBBox = __produceBBoxRes(jqTxt, "txt").concat(__produceBBoxRes(jqCntrAcr, "cntrlAct"), __produceBBoxRes(jqCntrDecor, "cntrlDecor"), __produceBBoxRes(jqGrColl));
				// check uniqueness of _id as a fool check -- this is possible for controls and images
				const uniqueIdSet = (new Set(resDataObj.data.allPrimitivesTypeBBox.map(x=>x._id)));
				if(uniqueIdSet.size !== resDataObj.data.allPrimitivesTypeBBox.length){
					console.warn("We have non-unique _ids in our primitives set ==> debug", window.location.href);
					uniqueIdSet.forEach((id, i) => {
						const subArrIds = resDataObj.data.allPrimitivesTypeBBox.filter(x=>x._id === id);
						if(subArrIds.length > 1){
							console.log("Non-unique ids:", subArrIds.map(x=>x._id).join(", "));
							const _nms = ["jqTxt", "jqCntrAcr", "jqCntrDecor", "jqGrColl"];
							[jqTxt, jqCntrAcr, jqCntrDecor, jqGrColl].forEach((jqCol, i) => {
								console.log(_nms[i], jqCol.toArray().filter(x=>x._id === id).map(window.__el2stringForDiagnostics));
							});
						}
					});
				}
				// 5 - Record computedStyles for all real primitives
				// window.toggleDomPrepForInstaManip("off"); // So we don't mess-up with computed styles
				resDataObj.data.allPrimitivesCmpStyles = __produceCmpStyleRes(jqTxt).concat(__produceCmpStyleRes(jqCntrAcr), __produceCmpStyleRes(jqCntrDecor), __produceCmpStyleRes(jqGrColl));
				// 5.1 - Disable styles and record computed props for each primitive <== so we can estimate what was changed and how <== NOTE: it's not enough to record it once and for all, because nestedness changes appearance too
				const _s = {noStylingCss: true, recalcNoStyling: thisIsIframe === true};
				resDataObj.data.allPrimitivesCmpStylesNoStyling = __produceCmpStyleRes(jqTxt, _s).concat(__produceCmpStyleRes(jqCntrAcr, _s), __produceCmpStyleRes(jqCntrDecor, _s), __produceCmpStyleRes(jqGrColl, _s));
				// window.toggleCssStyling("off");
				// resDataObj.data.allPrimitivesCmpStylesNoStyling = __produceCmpStyleRes(jqTxt).concat(__produceCmpStyleRes(jqCntrAcr), __produceCmpStyleRes(jqCntrDecor), __produceCmpStyleRes(jqGrColl));
				// window.toggleCssStyling("on");
				// // window.toggleDomPrepForInstaManip("on");
			});
		});
		// 6 - Record all links, their href, textContent, _id, ifVisible
		const pr5 = pr4.then(()=>{
			const allVisAarr = window.domGetters.getAllVis().filter("a").toArray();
			const jqAllA = $("a");
			resDataObj.data.links = jqAllA.toArray().map(elA=>{
				const ifVis = allVisAarr.includes(elA);
				const res = {
					href: elA.href,
					target: elA.target || "_self",
					visible: ifVis,
					cleanText: window._cutInvisCharExceptSpaces(window._getVisInnerTxt(elA, {noWarning: !ifVis}))
				};
				return __addElIdToObj(elA, res);
			});
		});
		// 7 - Record BG and Border primitives - I'm not sure they will be used in statistics, but let's keep them for now
		const pr6 = pr5.then(()=>{
			return window.domGetters.getOtherGrPromise("border").then((jqBorder)=>{
				const allCssProps = [...window.getComputedStyle(document.body)];
				const tmpBorderProps = ["border-bottom", "border-right", "border-left", "border-top"].map(bordProp=>allCssProps.filter(aProp=>aProp.indexOf(bordProp)>-1)).reduce((a, x)=>a.concat(x), []);
				resDataObj.data.borderEls = jqBorder.toArray().map(el=>{
					console.assert(el.__brdCol !== undefined, "We were supposed to initialize el.__brdCol for each element with borders during collection formation", window.location.href);
					const resObj = __addElIdToObj(el, Object.assign({}, el.__brdCol));
					const st = window.getComputedStyle(el);
					Object.assign(resObj, window._getAbsBoundingRectAdjForParentOverflow(el));
					Object.assign(resObj, Object.fromEntries(tmpBorderProps.map(prop=>[prop, st[prop]])));
					return resObj;
				});
			});
		});
		// 7.1 - BG change primitives
		const pr7 = pr6.then(()=>{
			return window.domGetters.getOtherGrPromise("bgColChange").then((jqBgChange)=>{
				resDataObj.data.bgChangeEls = jqBgChange.toArray().map(el=>{
					console.assert(el.__bgRGBcol !== undefined, "A bg element that we didn't calculate __bgRGBcol for: ", window.__el2stringForDiagnostics(el));
					const resObj = __addElIdToObj(el, {bgCol: (el.__bgRGBcol || ["NA"]).join("_")});
					Object.assign(resObj, window._getAbsBoundingRectAdjForParentOverflow(el));
					return resObj;
				});
			});
		});
		// 8 - Save window.domGetters.getGraphGrPromise("allNonBgBg") as images
		const pr8 = pr7.then(()=>{
			return putImagesInArrayAsync().then(resImgArr=>{
				screenshotsToSave.groups.graphics.push(...resImgArr);
			});
		});
		// 9 - All Semantic Groups: Record bbox, whiteSpace (incl. betw. char space), and screenshot ==> used backgrounds (with sizes) and borders (border length) could be extracted from bg/Border primitives
		// 9.1 - Computed Controls
		const pr9 = pr8.then(()=>{
			const jqGr = window.domGetters.getCntrlGr("computed");
			const primitives = {}; // empty, so semanticGroup2DataAsync gets them internally
			return semanticGroup2DataAsync(jqGr, {grName: "computedControls", grHasRootEls: true, keepOverlays: false, membershipNeeded: true, screenshotNeeded: false, debugScreenShotNeeded: true, skipCmpPrims: true}, primitives).then(cmpCntrlResObj =>{
				Object.assign(resDataObj.groups, cmpCntrlResObj.membership);
				Object.assign(screenshotsToSave.debug, cmpCntrlResObj.debug);				
				resDataObj.data.cmpCntrlGroupProps = cmpCntrlResObj.data;
			});
		});
		// 9.2 - Semantic Groups
		const pr10 = pr9.then(()=>{
			return __prepPrimitiveForGroupAnalysesAsync().then(primitives=>{
				return Promise.all(semGrNamesToRecord.map(window.domGetters.getSemanticGrPrms)).then(resArr=>{
					// 9.2.z - convenience re-assignment
					// const [jqTitles, jqHeaders, jqFooters, jqSocialButtons, jqMenusV, jqMenusH, jqMenusMixed, jqMenus, jqFuncAreas, jqLogos, jqOverlays, jqForms, jqRotatingBanners, jqMainBody, jqMainTxtChunksArr] = resArr;
					// not saving 'menus' because it's already done per menu type; mainTxtChunksArr require special treatment
					const promArr = semGrNamesToRecord.map((grName, i)=>{
						const jqGr = resArr[i];
						const grHasRootEls = grName !== "mainTxtChunksArr";
						const keepOverlays = grName === "overlays";
						return semanticGroup2DataAsync(jqGr, {grName: grName, grHasRootEls: grHasRootEls, keepOverlays: keepOverlays, membershipNeeded: true, screenshotNeeded: true, debugScreenShotNeeded: true, skipCmpPrims: false}, primitives);
					});
					return Promise.all(promArr).then(semGrResObjArr=>{
						// 9.2.b - transferring data into global objects
						semGrResObjArr.forEach(semResObj => {
							Object.assign(resDataObj.groups, semResObj.membership);
							Object.assign(screenshotsToSave.groups, semResObj.screenshots);
							Object.assign(screenshotsToSave.debug, semResObj.debug);
						});
						resDataObj.data.semanticGroupProps = semGrResObjArr.reduce((a, semGrResObj)=>{
							return a.concat(semGrResObj.data);
						}, []); // flattening it all down to a single arr to save as a single file
					});
				});				
			});
		});
		// 9.3 - Border elements as groups <-- not sure we'll use it, but let's keep it
		const pr11 = pr10.then(()=>{
			return window.domGetters.getOtherGrPromise("borderMoreThn1Side").then(jqGr=>{
				const primitives = {}; // empty, so semanticGroup2DataAsync gets them internally
				return semanticGroup2DataAsync(jqGr, {grName: "borderEnclosedEls", grHasRootEls: true, keepOverlays: true, membershipNeeded: true, screenshotNeeded: false, debugScreenShotNeeded: true, skipCmpPrims: false}, primitives).then(cmpCntrlResObj =>{
					Object.assign(resDataObj.groups, cmpCntrlResObj.membership);
					Object.assign(screenshotsToSave.debug, cmpCntrlResObj.debug);				
					resDataObj.data.brdEnclosedGroupProps = cmpCntrlResObj.data;
				});
			});
		});
		// 9.4 - record Special Semantic group props (cnvs/n invis images for banners; expandable menu structures; external links/src)
		// 9.4.1 - Banners - saving invisible images
		const pr12 = pr11.then(()=>{
			if(!semGrNamesToRecord.includes("rotatingBanners")){
				return Promise.resolve();
			}
			return window.domGetters.getSemanticGrPrms("rotatingBanners").then(_getBannerExtraDataAsync).then( resObj=>{
				resDataObj.data.bannerHiddImgData = resObj.data;
				screenshotsToSave.groups.bannerHiddImg = resObj.imgArr;
			});
		});
		// 9.4.2 - Menus - expandable items/invis items/structure
		const pr13 = pr12.then(()=>{
			if(['menusV', 'menusH', 'menusMixed'].every(m=>!semGrNamesToRecord.includes(m))){
				return Promise.resolve();
			}
			return window.domGetters.getSemanticGrPrms("menus").then(_getMenuExtraData).then(menuData=>{
				resDataObj.data.menuData = menuData;
			});
		});
		// 9.4.3 - Social areas -- external links + iframe VS link
		const pr14 = pr13.then(()=>{
			if(!semGrNamesToRecord.includes("socialButtons")){
				return Promise.resolve();
			}
			return window.domGetters.getSemanticGrPrms("socialButtons").then(_getSocAreaExtraData).then(d=>{
				resDataObj.data.socialAreaData = d;
			});
		}).then(()=>{
			// 9.4.4 - Functional areas -- widgets of functionality, like login, search or subscribe
			if(!semGrNamesToRecord.includes("funcAreas")){
				return Promise.resolve();
			}
			return window.domGetters.getSemanticGrPrms("funcAreas").then(_getFuncAreaExtraData).then(d=>{
				resDataObj.data.funcAreaData = d;
			});
		}).then(()=>{
			// 9.4.5 - FixedPosition menus/items/areas - I'm piggyBacking on pr13 here (too much hustle to create a new once)
			if(!semGrNamesToRecord.includes("fixedAreas")){
				return Promise.resolve();
			}
			return window.domGetters.getSemanticGrPrms("fixedAreas").then(_getFixedAreaExtraData).then(d=>{
				resDataObj.data.fixedAreaData = d;
			});
		});
		// 10 - Record page-level stats: dimensions, whiteSpace, effective width (width of the root element)
		const pr15 = pr14.then(()=>{
			const primitives = {}; // empty, so semanticGroup2DataAsync gets them internally
			return semanticGroup2DataAsync($(document.documentElement), {grName: "entirePage", grHasRootEls: true, keepOverlays: false, membershipNeeded: false, screenshotNeeded: false, debugScreenShotNeeded: false, skipCmpPrims: true}, primitives).then(resObj =>{
				return _getPageRootPropsAsync().then(extraResObj=>{
					Object.assign(resObj.data[0], extraResObj); // because resObj.data is an array
					resDataObj.data.pageGroupProps = resObj.data;
				});
			});
		});
		// 11 - Some fool checks; Converting dataObjArr to text
		const pr16 = pr15.catch(e=>{
			console.error(e, window.location.href);
		}).then(()=>{
			// NOTE: In-group membership is only for counting elements; Properties (incl. content alignment) will need to be computed/recorded for each group separately from their elements
			return {
				dataTables: __datObj2ArrForSaving(resDataObj.data, "txt", window.__objArr2TabTable), // [{name:string, dat:str, type:str}]
				membershipTables: __datObj2ArrForSaving(resDataObj.groups, "txt", __membership2TabTable), // [{name:string, dat:str, type:str}]
				debugScreenshots: __datObj2ArrForSaving(screenshotsToSave.debug, "jpeg", window.__cnvs2DataUrl, {type: "image/jpeg", quality: "mid"}), // [{name:string, dat:base64}]
				groupsOfImgArr: screenshotsToSave.groups // {[{name:string, dat:base64}]}
			};
		});
		return pr16;
	};

	function __datObj2ArrForSaving(obj, type = "txt", mapF = (x)=>x, mapFParams){
		// mapF is supposed to return a string
		return Object.keys(obj).map(key=>{
			return {name: key, type: type, dat: mapF(obj[key], mapFParams)};
		});
	}

	function _getPageRootPropsAsync(){
		// describes the root element of the page - the 1st element with several visible children <-- often used for "global" margins
		return Promise.all([window.domGetters.getSemanticGrPrms("rootEl"), window.domGetters.getGraphGrPromise("main")]).then(([jqRootEl, jqMainGr])=>{
			console.assert(jqRootEl.length === 1, "There must be only 1 rootEl", window.location.href);
			const rootEl = jqRootEl[0]; // if [0] element isn't there, let it fall.
			const rootBBox = window._getInnerBBox(rootEl);
			const resObj = {};
			// rename bbox props so we differentiate them from an <html>'s bbox
			Object.keys(rootBBox).forEach(k => {
				resObj["rootElInnBBox_"+k] = rootBBox[k];
			});
			// checking if we have any page-wise graphics
			// DEFINITION: either full-window or full-scrollingElement size
			// const fullHeight = 
			const FULL_SCREEN_HEIGHT = window.innerHeight * 0.9; // This includes a horizontal scrollbar -- should we switch to document.documentElement.clientHeight?
			const fullWindGrArr = jqMainGr.toArray().filter(grEl=>{
				// a - full window height or more 
				const b = window._getInnerBBox(grEl);
				if(b.height < FULL_SCREEN_HEIGHT){ // 0.9 to have a bit of tolerance
					return false;
				}
				// b - fixed position
				const st = window.getComputedStyle(grEl);
				if(st.getPropertyValue("position") !== "fixed"){ // we may have to include "sticky", but it's position is relative to a containing block, not viewport
					return false;
				}
				// c - top and/or bottom = 0
				const top = parseFloat(st.getPropertyValue("top"));
				const bot = parseFloat(st.getPropertyValue("bottom"));
				if((!isNaN(top) && top <= FULL_SCREEN_HEIGHT / 9) || (!isNaN(bot) && bot >= FULL_SCREEN_HEIGHT)){
					return true;
				}
				return false;
				// NOTE: width can be less than full window
			});
			const fullDocGrArr = jqMainGr.toArray().filter(grEl=>{
				if(fullWindGrArr.includes(grEl)){
					return false; // already checked above
				}
				const b = window._getInnerBBox(grEl);
				return b.height >= window.getScrlEl().scrollHeight * 0.9 && b.width >= window.__getSaneDocScrollWidth() * 0.9;
				// return b.height >= window.getScrlEl().scrollHeight * 0.9 && b.width >= window.getScrlEl().scrollWidth * 0.9;
			});
			resObj["fullWindGrElIds"] = fullWindGrArr.length?fullWindGrArr.map(x=>x._id).join("__"):"NA";
			resObj["fullDocGrElIds"] = fullDocGrArr.length?fullDocGrArr.map(x=>x._id).join("__"):"NA";
			// throw in scrollWidth/height
			resObj["docScrollWidth"] = window.__getSaneDocScrollWidth();
			resObj["docScrollWidthNotSane"] = window.getScrlEl().scrollWidth;
			// resObj["docScrollWidth"] = window.getScrlEl().scrollWidth;
			resObj["docScrollHeight"] = window.getScrlEl().scrollHeight;
			return resObj;
		});
	}

	function _getSocAreaExtraData(jqSocialButtons){
		// not much -- just extracting href (if it's an <a>) or src (if it's an iframe)
		return jqSocialButtons.toArray().map(el=>{
			return __addElIdToObj(el, {tag: el.tagName.toLowerCase(), btnIds: el._btnIds, btnUrls: el._btnUrls, socAreaType: el._socAreaType});
		});
	}
	
	function _getFixedAreaExtraData(jqFixedAreas){
		return jqFixedAreas.toArray().map(el=>{
			const resObj = Object.assign({location: el._stickyPosition, tag: el.tagName.toLowerCase()}, el._origBBox);
			return __addElIdToObj(el, resObj);
		});		
	}
	
	function _getFuncAreaExtraData(jqFuncAreas){
		// not much -- just extracting href (if it's an <a>) or src (if it's an iframe)
		return jqFuncAreas.toArray().map(el=>{
			return __addElIdToObj(el, {tag: el.tagName.toLowerCase(), funcAreaType: el._funcAreaType});
		});
	}

	function _getBannerExtraDataAsync(jqBanners){
		const prArr = jqBanners.toArray().map(bannerEl=>{
			const bannerItemProtoResObj = {bannerId: bannerEl._id};
			return Promise.allSettled(bannerEl._hiddImgs.map(hidImgEl=>{
				const url = __el2src(hidImgEl);
				if(url === null){
					return Promise.resolve({hidImgEl: hidImgEl, reason: "Not an image"});
				}
				return window.url2canvasAsync(url).then(cnvs=>{
					return {hidImgEl: hidImgEl, cnvs: cnvs};
				}).catch(err=>{
					return  {hidImgEl: hidImgEl, reason: err};
				});
			})).then(vals=>{
				const imagesToSaveArr = [];
				const reportArr = vals.map(res=>{
					// note: we always have resolved promises since we handle rejects above
					if(res.value.reason){
						return Object.assign({}, bannerItemProtoResObj, {width: "NA", height: "NA", id: "NA", tagName: res.value.hidImgEl.tagName.toLowerCase(), loadFailReason: res.value.reason});						
					}
					const elId = res.value.hidImgEl._id || window._generateId();
					const tag = res.value.hidImgEl.tagName.toLowerCase();
					imagesToSaveArr.push({name: [tag, elId, "HIDDEN_IMG"].join("_"), dat: window.__cnvs2DataUrl(res.value.cnvs)});
					return Object.assign({}, bannerItemProtoResObj, {width: res.value.cnvs.width, height: res.value.cnvs.height, id: elId, tagName: tag, loadFailReason: "NA"});						
					// if(res.status === "rejected"){
					// 	return Object.assign({}, bannerItemProtoResObj, {width: "NA", height: "NA", id: "NA", tagName: res.reason.hidImgEl.tagName.toLowerCase(), loadFailReason: res.reason.reason});
					// }
					// if(res.status === "fulfilled"){
					// 	const elId = res.value.hidImgEl._id || window._generateId();
					// 	const tag = res.value.hidImgEl.tagName.toLowerCase();
					// 	imagesToSaveArr.push({name: [tag, elId, "HIDDEN_IMG"].join("_"), dat: window.__cnvs2DataUrl(res.value.cnvs)});
					// 	return Object.assign({}, bannerItemProtoResObj, {width: res.value.cnvs.width, height: res.value.cnvs.height, id: elId, tagName: tag, loadFailReason: "NA"});
					// }
					// console.error("We can't be here... A promise is either fulfilled or rejected"); // fool check
				});
				return {reportArr: reportArr, imagesToSaveArr: imagesToSaveArr};
			});
		});
		return Promise.all(prArr).then(resArr=>{
			// flatten array
			const singleReport = resArr.reduce((a, x)=>a.concat(x.reportArr), []);
			const singleArrHiddImgToSave = resArr.reduce((a, x)=>a.concat(x.imagesToSaveArr), []);
			return {data: singleReport, imgArr: singleArrHiddImgToSave};
		});
	}

	function __el2src(el){
		// return img.src if el is an image; otherwise looks at background-image and a URL in it
		if(el.tagName.toLowerCase() === "img"){
			return el.src;
		}
		const bgImg = window.getComputedStyle(el).getPropertyValue("background-image");
		if(bgImg.indexOf("url") > -1){
			// returning the 1st specified url -- even if we have many layered images 
			// FIXME save all images?
			const url = bgImg.split("url(")[1].split(")")[0].replaceAll("\"", ""); // CSS automatically resolves relative urls
			return url;
		}
		return null; // not an image
	}

	function _getMenuExtraData(jqMenus){
		// Gets extra features (beyond the defaults for SemanticGroups) for Menus - each menu item (visible and hidden) is a row
		const visTxtEls = window.domGetters.getTxtGr("allNoCntrl").toArray();
		return jqMenus.toArray().map(menuEl=>{
			const rowObjProto = {menuElId: menuEl._id, isNested: menuEl._isNested};
			// we use _sortedItems to preserve the structure of a menu
			return menuEl._sortedItems.map((itemEl, i)=>{
				var txt, href;
				if(menuEl._hiddenAnchor){
					txt = window.cleanString(menuEl.textContent);
					href = menuEl.href;
				}else{
					// visible menu items are often not links themselves -- they have text, but not href
					txt = visTxtEls.filter(x=>itemEl.contains(x)).map(x => window._getFullTextCleanAllButSpaces(x)).join("___");
					const aEl = (itemEl.tagName.toLowerCase() === "a")?itemEl:$(itemEl).find("a:visible").toArray()[0];
					href = (aEl)?aEl.href:"NA";
				}
				return Object.assign({}, rowObjProto, {hiddenItem: itemEl._hiddenAnchor === true, txt: txt, href: href, order: i}, __addElIdToObj(itemEl, {}));
			});
		}).flat(); // flatten array
	}

	function _findPrimitivesForEachGroup(jqGrColl, primArr, idArr){
		// Preps data for __membership2TabTable; finds visible children (from primArr) for each (sub) group
		// jqGrColl is always an array
		return jqGrColl.map((x, i)=>{
			var nodes;
			if(x._thisIsARoot){
				const grEl = x;
				nodes = primArr.filter(primEl=>grEl.contains(primEl));
			}else{
				const subArrEls = x;
				if(typeof subArrEls.some !== "function"){
					debugger;
				}
				
				nodes = primArr.filter(primEl=>subArrEls.some(subGrEl=>subGrEl.contains(primEl)));
			}
			return {_id: idArr[i], nodes: nodes, i: i};
		});
	}

	function __membership2TabTable(membArr){
		// NOTE: membArr should contain {_id: groupId, nodes: elArr} objects
		// 1 - Get the full list of nodes
		const allPossibleNodes = [... new Set(membArr.map(x=>x.nodes.map(el=>el._id)).reduce((a, x)=>a.concat(x), []))];
		console.assert(!allPossibleNodes.includes(undefined), "Some primitives/nodes didn't have an _id, allPossibleNodes: ", JSON.stringify(allPossibleNodes), window.location.href);
		// 2 - Construct an array with true/false for membership
		const outArr = membArr.map(x=>{
			const grElIds = x.nodes.map(el=>el._id);
			console.assert(x.nodes.length === [... new Set(x.nodes)].length, "Duplicate nodes in a group!");
			return Object.assign({groupId: x._id}, Object.fromEntries(allPossibleNodes.map(anId=>[anId, grElIds.includes(anId)])));
		});
		// 3 - Convert to text
		return window.__objArr2TabTable(outArr);
	}

	function __prepPrimitiveForGroupAnalysesAsync(){ // convenience F; renaming/collecting what we need for group prop recording
		const primGrNames = ["bgColChange", "border", "allPrimitivesNoCmpCntrl", "allPrimitives"];
		const primitives = {};
		return Promise.all(primGrNames.map(window.domGetters.getOtherGrPromise)).then(primEls => {
			primEls = primEls.map(x=>x.toArray());
			primitives.bgPrimsElArr = primEls[0];
			primitives.brdPrimsElArr = primEls[1];
			primitives.allPrimsNoCmpCntrlElArr = primEls[2];
			primitives.allPrimsElArr = primEls[3];
		}).then(()=>{
			return window.domGetters.getSemanticGrPrms("overlays");
		}).then(jqOverlays=>{
			primitives.overlElArr = jqOverlays.toArray();
			return primitives;
		});
	}
	
	function __prepPrimitiveForGroupAnalyses2(primitives, settings){
		// simply outsourcing code from semanticGroup2DataAsync -- it's just too ugly to keep it all in one F
		const brdAndBgEls = primitives["brdPrimsElArr"].concat(primitives["bgPrimsElArr"]);
		const overlArr = primitives.overlElArr;
		// if(!settings.skipCmpPrims){
		// 	var primsWitCmpCntrl = primitives["allPrimsElArr"].concat(brdAndBgEls).filter(primEl => {
		// 		if(settings.keepOverlays){
		// 			return true;
		// 		}
		// 		return !overlArr.some(overEl=>overEl.contains(primEl));
		// 	});
		// }
		const primsWitCmpCntrl = primitives["allPrimsElArr"].concat(brdAndBgEls).filter(primEl => {
			if(settings.keepOverlays){
				return true;
			}
			return !overlArr.some(overEl=>overEl.contains(primEl));
		});
		const primsNoCmpCntrl = primitives["allPrimsNoCmpCntrlElArr"].concat(brdAndBgEls).filter(primEl => {
			if(settings.keepOverlays){
				return true;
			}
			return !overlArr.some(overEl=>overEl.contains(primEl));
		});
		return {overlArr: overlArr, primsNoCmpCntrl: [... new Set(primsNoCmpCntrl)], primsWitCmpCntrl: [... new Set(primsWitCmpCntrl)]};
	}

	// // NOTE: I feel I've made this F needlessly complicated ==> // OPTIMIZE: move primitive assembling out; split membership from data acquisition
	// NOTE: grHasRootEls: true <-- no longer used
	function semanticGroup2DataAsync(jqGrColl, settings = {grName: null, keepOverlays: false, membershipNeeded: true, screenshotNeeded: true, debugScreenShotNeeded: true, skipCmpPrims: false}, primitives = {allPrimsElArr: null, allPrimsNoCmpCntrlElArr: null, brdPrimsElArr: null, bgPrimsElArr: null, overlElArr: null}){
		// F extracts saveable data from a semantic group
		// grHasRootEl: false for groups that are collections of sub-elements/parts, without a signle root element to look up the inheritance <-- affects membership estimation
		// jqGrColl can be jqObj or an arrArr of elements
		return (primitives.allPrimsElArr?Promise.resolve(): __prepPrimitiveForGroupAnalysesAsync()).then((_primitives) => {
			if(_primitives !== undefined){
				primitives = _primitives;
			}
			// 0.1 - Some more set-up
			var _grBBoxes = null;
			const outRes = {
				membership: {}, // tabTable as str
				data: [], // objArr <-- needs to be merged with similar objArr for other groups, to reduce the N of files we generate <-- We keep it as an array; no need to save grName as a key (it's already saved as a column there)
				screenshots: {}, // {name: str, dat: base64Str}
				debug: {} // base64Str fullpage screenshot
			};
			if(settings.grName === null){
				console.warn("No Semantic group name supplied --> generating an artificial one");
				settings.grName = "Genrd_" + window._generateId();
			}
			if(settings.keepOverlays){
				console.warn("Keeping overlays for the group: ", settings.grName);
			}
			if(!jqGrColl.length){
				console.warn("No elements in the group ", settings.grName, " --> returning nulls instead of data");
				return outRes;
			}
			// 0.2 - convert jq Obj to array
			if(!Array.isArray(jqGrColl)){
				jqGrColl = jqGrColl.toArray();
			}
			// 0.3 - Artificial IDs for groups that don't correspond to a single DOM node
			const grIdArr = jqGrColl.idArr || jqGrColl.map(el=>{
				return el._id || "artifGrId_" + window._generateId();
			}); // This is such a dumb shortcut - I hate it.
			if(grIdArr.length !== jqGrColl.length){
				debugger;
			}
			console.assert(grIdArr.length === jqGrColl.length, "ID/group length mismatch", grIdArr.length, jqGrColl.length);
			// 0.4 - check if jqGrColl contains roots
			jqGrColl.forEach(item => {
				if(item._thisIsARoot !== undefined){
					return; // do nothing
				}
				item._thisIsARoot = !Array.isArray(item);
			});
			// 1 - Prep primitives for membership tables
			const {overlArr, primsNoCmpCntrl, primsWitCmpCntrl} = __prepPrimitiveForGroupAnalyses2(primitives, settings);
			// 2 - Create a membership table
			if(settings.membershipNeeded){
				if(!settings.skipCmpPrims){
					outRes.membership[settings.grName] = _findPrimitivesForEachGroup(jqGrColl, primsWitCmpCntrl, grIdArr);
				}
				outRes.membership[settings.grName + "_noCmpCntrl"] = _findPrimitivesForEachGroup(jqGrColl, primsNoCmpCntrl, grIdArr);
			}
			// 3 - Save generic per-group props; constituent bboxes; bgColor; WhiteSpace
			return _getSemGrPropsAsync(jqGrColl, {keepOverlays: settings.keepOverlays, idArr: grIdArr, overlElArr: overlArr, primArr: primitives["allPrimsNoCmpCntrlElArr"], primArrCmp: primitives["allPrimsElArr"]}).then((grDatArr)=>{
				outRes.data = grDatArr.map(obj=>Object.assign(obj, {grName: settings.grName}));
			}).then(()=>{
				// 4 - Save a screenshot of groups bboxes highlighted
				if(settings.debugScreenShotNeeded){
					_grBBoxes = __mapGr2BboxesFromResObj(outRes.data, grIdArr);
					const bboxArr = Object.values(_grBBoxes).filter(x=>x);
					// const bboxArr = grIdArr.map(grId=>{
					// 	const outResSubArr = outRes.data.filter(x=>x.grId === grId).map(resObj=>{
					// 		// handling collapsed elements, e.g., due to floats
					// 		if(resObj.width === 0 || resObj.height === 0){
					// 			return window._getFloatProofBBox(resObj.__el);
					// 		}
					// 		return resObj;
					// 	});
					// 	console.assert(outResSubArr.length, "No primitives/roots in a groups?.. can't be. Debug."); // it can in some rare cases of a) zero-sized root and b) no internal primitives found
					// 	if(!outResSubArr.length){
					// 		debugger;
					// 		console.warn("A group has been filtered out by _getSemGrPropsAsync, grId:", grId);
					// 		return null;
					// 	}
					// 	if(outResSubArr.length === 1){ // 1 element per group, aka the root
					// 		return outResSubArr[0]; // <== it contains bbox props in it, so let's just use it without creating new objects
					// 	}
					// 	return __bboxArr2singleBbox(outResSubArr); // several elements per group --> we should get their combined bbox
					// }).filter(x=>x);
					console.assert(bboxArr.length, "No bboxes to highlight. Where all groups filtered out by _getSemGrPropsAsync? Debug.");
					outRes.debug[settings.grName] = window.highlightRectsOnCnvs(window.getStoredFullPageCanvas(), bboxArr);	
				}
			}).then(()=>{
				// 5 - Save screenshots of each group bbox <== We may want to disable it later on, seems a bit expensive
				const scrnshotPromise = (!settings.screenshotNeeded)?Promise.resolve(): 	Promise.all(outRes.data.map(resObj=>{
					// we kept a reference to the element here - to avoid recalculating adjustedBBoxes
					if(_grBBoxes === null){
						// initializing
						_grBBoxes = __mapGr2BboxesFromResObj(outRes.data, grIdArr);
					}
					// const ifBgEl = false; // so we don't hide the internals, only overlays
					const hideChildren = false;
					const whiteBg = false;
					const bbox = _grBBoxes[resObj.grId];
					if(!bbox){
						console.error("No group bbox to screenshot -- can happen, but rare. Investigate.", resObj);
						debugger;
						return Promise.resolve(null);
					}
					// // again handle collapsed elements
					// var bbox = resObj;
					// if(bbox.width === 0 || bbox.height === 0){
					// 	bbox = window._getFloatProofBBox(resObj.__el);
					// }
					return window._el2canvasNoOverlaysAsync(resObj.__el, bbox, hideChildren, $(primitives.overlElArr), whiteBg).then(cnvs=>{
						const r = resObj;
						return {
							name: [settings.grName, (r.grId || r.elId), r.elId, r.top, r.left, r.width, r.height, r.__el.tagName.toLowerCase()].join("_"),
							dat: window.__cnvs2DataUrl(cnvs)
						};
					});
				})).then(imgDatArr =>{
					outRes.screenshots[settings.grName] = imgDatArr.filter(x=>x);
					console.assert(outRes.screenshots[settings.grName].length, "No group screenshots to save - hopefull nothing will fall because of this");
				});
				return scrnshotPromise.then(()=>{
					// clean up __el from outRes.data
					outRes.data.forEach((item, i) => {
						item.__el = item.__el.tagName.toLowerCase();
					});
					// 6 - return
					return outRes;
				});
			});
		});
	}
	
	function __mapGr2BboxesFromResObj(resObjArr, grIdArr){
		// single use F; extracts bboxes to highlight on a canvas for semantic/computed groups
		// inGrPrimBBox_//
		return Object.fromEntries(grIdArr.map(grId=>{
			const outResSubArr = resObjArr.filter(x=>x.grId === grId);
			// NOTE: past method of handling collapsed elements below - get back to it if needed
			// .map(resObj=>{
			// 	// handling collapsed elements, e.g., due to floats
			// 	if(resObj.width === 0 || resObj.height === 0){
			// 		return window._getFloatProofBBox(resObj.__el);
			// 	}
			// 	return resObj;
			// });
			console.assert(outResSubArr.length, "No primitives/roots in a groups?.. can't be. Debug."); // it can in some rare cases of a) zero-sized root and b) no internal primitives found
			if(!outResSubArr.length){
				debugger;
				console.warn("A group has been filtered out by _getSemGrPropsAsync, grId:", grId);
				return null;
			}
			if(outResSubArr.length === 1){ // 1 element per group, aka the root
				// choosing a larger bbox between grBbox and inGrPrimBBox_ <-- should also handle collapsed elements
				const grB = outResSubArr[0];
				if(grB["inGrPrimBBox_height"] !== "NA" && (grB["height"] <= 0 || grB["width"] <= 0)){
					console.warn("Using inGrPrimBBox to highlight a group", grId, grB);
					return Object.fromEntries(Object.entries(grB).filter(([k, v])=>k.indexOf("inGrPrimBBox") > -1).map(([k, v])=>[k.replace("inGrPrimBBox_", ""), v]));
				}
				return grB; // <== it contains bbox props in it, so let's just use it without creating new objects
			}
			return __bboxArr2singleBbox(outResSubArr); // several elements per group --> we should get their combined bbox
		}).map((b, i)=>{
			console.assert(b === null || (b.height > 0 && b.width > 0), "A zero-sized bbox for a group, ", b, grIdArr[i]);
			// converting into an object for easy selection by grId
			return [grIdArr[i], b];
		}));
	}
	
	function ___makeNAbbox(){
		return Object.fromEntries(Object.entries(window.__cpyBBox({})).map(([k, val])=>[k, "NA"]));
	}

	function _getSemGrPropsAsync(elArrArr, settings = {keepOverlays: false, idArr: null, overlElArr: null, primArr: null, primArrCmp: null}){
		// Extracts data to save/describe a semantic group
		// We only record 3 types of direct props for groups -- its bbox, useful whiteSpace and bgColor (We record background color in case the group contains no bg elements, and relies on the color underneath)
		// if grColl contains artifical groups (those that don't correspond to a single DOM element) we should have idArr supplied
		if(!settings.keepOverlays){
			console.assert(settings.overlElArr, "You forgot to supplies Overlays to filter out.");
		}
		const allVis = window.domGetters.getAllVis().toArray().filter(el=>{
			if(settings.keepOverlays){
				
				return true;
			}
			return !settings.overlElArr.some(overlEl=>overlEl.contains(el));
		});
		return Promise.all(elArrArr.map((x, i)=>{
			const grId = settings.idArr[i];
			const elArr = (x._thisIsARoot)?[x]:x;
			const extraProps = {grId: grId, grHasRoot: x._thisIsARoot, grIsIfr: x._thisIsIFrame === true};
			if(x._thisIsARoot){
				// recording a fit-primitives-only bbox <-- to calc alignment points based on groups and their content <-- because primitives (aka, real content) is what visually determines bboxes
				// NOTE: sometimes no-cmpCntrl primitives miss out on styled buttons --> we should use cmpCntrl collection instead in this case --> just check which collection results in more children found
				const _inGrPrimsWithCmp = settings.primArrCmp.filter(primEl=>x.contains(primEl));
				const _inGroupPrimsNoCmp = settings.primArr.filter(primEl=>x.contains(primEl)); // previously default option
				const inGroupPrims = (_inGroupPrimsNoCmp.length < _inGrPrimsWithCmp.length)?_inGrPrimsWithCmp:_inGroupPrimsNoCmp; 
				//settings.primArr.filter(primEl=>x.contains(primEl));
				if(inGroupPrims.length){ // some groups have no detectable primitives in them -- empty elements, or external iframes
					const primBBoxes = inGroupPrims.map(primEl=>window._getAbsBoundingRectAdjForParentOverflow(primEl, true, false, "inner"));
					const inGPrimBBox = __bboxArr2singleBbox(primBBoxes);
					Object.assign(extraProps, __addPrefixToObjKeys(inGPrimBBox, "inGrPrimBBox_"));
				}else{
					// add NAs -- otherwise our 2tabTable f doesn't record these props
					Object.assign(extraProps, __addPrefixToObjKeys(___makeNAbbox(), "inGrPrimBBox_"));
				}
				// checking if the root is zero-sized -- possible for semantic groups
				// const b = x.getBoundingClientRect();
				const b = window._getAbsBoundingRectAdjForParentOverflow(x);
				// extraProps.zeroSizedRoot = (b.width * b.height) < 1;
				extraProps.zeroSizedRoot = b.width < 1 || b.height < 1; // We need at least 1px to have a canvas of it for bgCol estimation
				if(extraProps.zeroSizedRoot){
					// replace the root with primitives it contains
					console.assert(elArr.length === 1, "elArr contains smth besided the root?...", window.location.href);
					elArr.shift(); // it's supposed to be length === 1, so 1 shift is enough
					elArr.push(...inGroupPrims);
				}
			}else{
				extraProps.zeroSizedRoot = "NA";
				// add NAs -- otherwise our 2tabTable f doesn't record these props
				Object.assign(extraProps, __addPrefixToObjKeys(___makeNAbbox(), "inGrPrimBBox_"));
			}
			const prArr = elArr.map(el=>__getWhSpBboxBgColAsync(el, allVis, extraProps));
			return Promise.all(prArr);
			// .then(resObj=>{
			// 	if(x._thisIsARoot){
			// 		// recording a fit-primitives-only bbox <-- to calc alignment points based on groups and their content <-- because primitives (aka, real content) is what visually determines bboxes
			// 		const inGroupPrims = settings.primArr.filter(primEl=>x.contains(primEl));
			// 		if(inGroupPrims.length > 1){ // some groups have no detectable primitives in them -- empty elements, or external iframes
			// 			const primBBoxes = inGroupPrims.map(primEl=>window._getAbsBoundingRectAdjForParentOverflow(primEl, true, false, "inner"));
			// 			const inGPrimBBox = __bboxArr2singleBbox(primBBoxes);
			// 			resObj = Object.assign(resObj, __addPrefixToObjKeys(inGPrimBBox, "inGrPrimBBox_"));	
			// 		}
			// 	}
			// 	return resObj;
			// });
		})).then(resObjArrArr=>{
			// flatten resObjArrArr
			return resObjArrArr.reduce((a, x)=>a.concat(x), []);
		});
	}
	
	function __addPrefixToObjKeys(obj, prefix){
		return Object.fromEntries(Object.entries(obj).map(([key, val])=>[prefix+key, val]));
	}

	const __getWhSpBboxBgColAsyncREF = {}; // for speed up - we do this for lots of primitives many times over
	function __getWhSpBboxBgColAsync(el, groupElVisDescArr = [], extraProps = {}){
		if(el._id && __getWhSpBboxBgColAsyncREF[el._id]){
			return Promise.resolve(Object.assign({}, __getWhSpBboxBgColAsyncREF[el._id], extraProps)); // copying a ready result obj // extraProps should be overwritten
		}
		// to be used in _getSemGrProps - Records whiteSpace, bgColor, and bbox for a single element - a semantic group
		// grId should be supplied if 'el' isn't the root element
		const bbox = window._getAbsBoundingRectAdjForParentOverflow(el);
		// NOTE: we use the outer BBox for white space computation -- so let's save it for the parent/container -- otherwise the ratios (whSpace to space) may be biased
		const outBBox = __addPrefixToObjKeys(window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "outer"), "outer_");
		// const outBBox = Object.fromEntries(Object.entries(window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "outer")).map(([key, val])=>["outer_"+key, val]));
		const resObj = Object.assign(__addElIdToObj(el, {tagName: el.tagName.toLowerCase()}), extraProps, bbox, outBBox, cmpUsefulWhiteSpace(el, groupElVisDescArr));
		resObj.elId = resObj._id; // only for semantics/debug - easier to understand what comes from what
		resObj.__el = el; // a convenience reference <-- we'll rely on it for screenshotting groups; Don't forget to remove later
		return window.getBgColorAsync(el, null, (bbox.width*bbox.height>1)?bbox:null).then((rgbCol)=>{
			// console.log("Got bg Color for one element, ", el.tagName.toLowerCase(), el._id);
			resObj.bgColRgb = rgbCol.join("_");
			// resObj = __addElIdToObj(el, resObj)
			__getWhSpBboxBgColAsyncREF[el._id] = Object.assign({}, resObj); // saving a result -- it's all the same <== But we should clone it, otherwise external F write props in it
			return resObj;
		});
	}
	
	function __minZero(val){
		// can white space be negative? Probably not, it's either present or not --> zero negative whiteSpace 
		return Math.max(val, 0);
	}
	
	function cmpFlexWhSpace(elAndChildren){
		// 3 - If an element is display:flex/inline-flex <-- sum up their grid-gaps/between container spaces
		const newPositStyles = ["flex", "inline-flex", "grid", "inline-grid"];
		const flexSpace = elAndChildren.reduce((accu, pEl)=>{
			const st = window.getComputedStyle(pEl);
			const pInBBox = window._getInnerBBox(pEl);
			if(newPositStyles.includes(st.display) && (pInBBox.width * pInBBox.height) > 4){ // if less than 4 pixels, ignore it
				//  get all visibile descendants' bboxes
				const elVisDesc = Array.from(pEl.childNodes).filter(el=>elAndChildren.includes(el));
				if(elVisDesc.length){
					// const descBBoxArr = elVisDesc.map(window._getOuterBBox);
					const descBBoxArr = elVisDesc.map(el=>window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "outer"));
					// choose smallest positive distance (or dist to/from the parent box) - in both directions
					// NOTE: we do it this way (instead of subtracting children's bboxes from parent's), because we want to measure the good, intended white space -- we have other ways to measure full/wasted white space
					// const pBbox = pEl.getBoundingClientRect(); // we actually need padding in this one
					const pBbox = window._getAbsBoundingRectAdjForParentOverflow(pEl, true); // regular version keep padding in, margins out
					const MIN_OVERLAP = 0.5; // pixels
					var smallestYdist = descBBoxArr.map(aBbox=>{
						// const topDist = [aBbox.top - pBbox.top]; 
						const topDist = [Math.max(aBbox.top - pBbox.top, aBbox.bottom - pBbox.bottom)]; // we take Max, because the comparison with Parent's BBox should only be done for a single-row of elements ==> and 'overflow' of white space will be clipped during the canvas stage
						descBBoxArr.forEach(anotherBbox => {
							if(anotherBbox !== aBbox && window.__do2intervalsOverlap(aBbox, anotherBbox, "X", MIN_OVERLAP) && !window.__do2intervalsOverlap(aBbox, anotherBbox, "Y", MIN_OVERLAP)){
								topDist.push((aBbox.top - anotherBbox.bottom) / 2); // Divide by 2 because both blocks contribute to white space
							}
						});
						const smallestYdistForABbox = topDist.filter(x=>x>=0).sort((a, b)=>a-b)[0];
						if(smallestYdistForABbox === undefined){
							// NOTE: this is possible - we take outer bboxes for children, and their marging may be quite large and be discarded generally
							console.warn("We should have at least >= 0 distance found, but we dont:", topDist, window.location.href); // though maybe all children are detached in a different rendering context?...
						}
						return smallestYdistForABbox;
					}).filter(x=>x!==undefined).sort((a, b)=>a-b)[0]; 
					// repeat for X direction
					var smallestXdist = descBBoxArr.map(aBbox=>{
						// const leftDist = [aBbox.left - pBbox.left]; 
						const leftDist = [Math.max(aBbox.left - pBbox.left, aBbox.right - pBbox.right)]; 
						descBBoxArr.forEach(anotherBbox => {
							if(anotherBbox !== aBbox && window.__do2intervalsOverlap(aBbox, anotherBbox, "Y", MIN_OVERLAP && !window.__do2intervalsOverlap(aBbox, anotherBbox, "X", MIN_OVERLAP))){
								leftDist.push((aBbox.left - anotherBbox.right)/2);
							}
						});
						const smallestXdistForABbox = leftDist.filter(x=>x>=0).sort((a, b)=>a-b)[0]; // we use filter, so we only keep items that are to the left of the aBbox
						if(smallestXdistForABbox === undefined){
							console.warn("We should have at least >= 0 distance found, but we dont:", leftDist, window.location.href);
						}
						return smallestXdistForABbox;
					}).filter(x=>x!==undefined).sort((a, b)=>a-b)[0];
					// if we do have numeric distances
					if(smallestYdist !== undefined && smallestXdist !== undefined){
						if(smallestYdist >= 0.5 || smallestXdist >= 0.5){ // otherwise don't bother -- too small to count
							// add these dist to the each container's outerBBox
							const adjustedBBoxes = descBBoxArr.map(_bbox=>{
								const bbox = window.__cpyBBox(_bbox);
								bbox.left -= smallestXdist;
								bbox.right += smallestXdist;
								bbox.top -= smallestYdist;
								bbox.bottom += smallestYdist;
								bbox.x = bbox.left;
								bbox.y = bbox.top;
								bbox.width = bbox.right - bbox.left;
								bbox.height = bbox.bottom - bbox.top;
								return bbox;
							});
							// create a placeholder array representing our page
							const pageWidth = window.__getSaneDocScrollWidth();
							// // const pageWidth = window.getScrlEl().scrollWidth;
							// const pageSize = pageWidth * window.getScrlEl().scrollHeight;
							// const _tOldBegin = Date.now(); // TIME
							// const pageAsFlatArr = (new Int16Array(pageSize)).fill(-1 * adjustedBBoxes.length); // filling with neg values so anything outside parent's innerBBox is <= 0
							// // creating a window for imprinting rects -- parent's innerBBox - with values === 0
							// window.imprintRectOnFlatArr(pageAsFlatArr, pageWidth, window._getInnerBBox(pEl), +1 * adjustedBBoxes.length);
							// // imprinting flexBox white marings 
							// adjustedBBoxes.forEach(adjBbox => {
							// 	window.imprintRectOnFlatArr(pageAsFlatArr, pageWidth, adjBbox, +1);
							// });
							// // take the internals of each bbox out -- they are already accounted for (so we have rectangular "donuts")
							// descBBoxArr.forEach(outerBbox => {
							// 	window.imprintRectOnFlatArr(pageAsFlatArr, pageWidth, outerBbox, -10); // FIXME: I hope -10 is enough to account also for possible "spillage" of other elements inside the current bbox
							// });
							// // count "pixels" that are > 1; if a pixel > 1, it's an overlap, but we don't care and count it once
							// const flexWhiteSp = pageAsFlatArr.filter(x=>x>0).length;
							// const whSpOldMeth = __minZero(flexWhiteSp);
							// const _tOldEnd = Date.now(); // TIME
							// const _tCnvsBegin = Date.now(); // TIME
							const whSpCanvasMeth = window.countFlexWhiteSpace(pageWidth, window.getScrlEl().scrollHeight, pInBBox, adjustedBBoxes, descBBoxArr); // 20 times faster than the Old method <-- also accounts for non-round coordiante
							// const _tCnvsEnd = Date.now(); // TIME
							// console.log("[FLEX] White space: whSpCanvasMeth", whSpCanvasMeth, "Time: ", (_tCnvsEnd-_tCnvsBegin), "whSpOldMeth: ", whSpOldMeth, "Time:", (_tOldEnd-_tOldBegin));
							// console.assert(whSpOldMeth === whSpCanvasMeth, "Old and Canvas methods give diff Wh Sp estimates", window.location.href);
							accu += whSpCanvasMeth;
						}
					}
				}
			}
			return accu;
		}, 0);
		return flexSpace;
	}

	function cmpUsefulWhiteSpace(groupEl, groupElVisDescArr = []){
		// We should supply groupElVisDesc - because sometimes we don't want groupElVisDesc to contain overlays and their content
		// 1 - Get all visible decsendants of the target/group element
		// const elAndChildren = window.domGetters.getAllVis().filter((i, el)=>groupEl.contains(el));
		// const _allVisElsAsArrTMP = window.domGetters.getAllVis().toArray();
		groupElVisDescArr.push(groupEl);
		const elAndChildren = [... new Set(groupElVisDescArr.filter(el=>groupEl.contains(el)))]; // ensure they are unique to avoid double-counting white space
		// 2 - Sum up all padding/margins
		const paddingMaringSpace = elAndChildren.reduce((accu, el)=>{
			// TODO: 1) adjust for parent overflow
			// TOOD: 2) use size -- subtracting bboxes isn't possible
			const inBox = window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "inner");
			const outBox = window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "outer");
			return accu += __minZero(Math.max(outBox.width, 0) * Math.max(outBox.height, 0) - Math.max(inBox.width, 0) * Math.max(inBox.height, 0));
		}, 0);
		// // 3 - If an element is display:flex/inline-flex <-- sum up their grid-gaps/between container spaces
		// // NOTE: we do it this way - instead of subtracting children sizes from parent's container - because we want to estimate "useful"/"planned" white space VS "wasted white space"
		const flexSpace = cmpFlexWhSpace(elAndChildren);
		// 4 - Text-Related WhiteSpace -- betweenWord, betweenLine and LineHeight space
		// 4.1 - Intersect elAndChildren with visible text elements
		const allVisTxt = window.domGetters.getTxtGr("allNoCntrl").toArray();
		const txtElArr = elAndChildren.filter(el=>allVisTxt.includes(el));
		// 4.2 - Sum up white spaces
		const txtWhiteSpace = txtElArr.reduce((accu, el)=>{
			const st = window.getComputedStyle(el);
			// a - get inline rects
			__wrapBlockElContentsInSpan(el);
			const rects = Array.from(el.childNodes).map(x=>Array.from(x.getClientRects())).flat();
			__unwrapBlockElContentsFromSpans(el);
			// b - Line height
			const btwLineHeight = _getBtwLineSpace(el, st);
			accu+= __minZero(btwLineHeight * 2 * rects.reduce((accu, rect)=>(accu + rect.width), 0));
			// c - Between word spacing
			const wordSpacing = __calcWordSpacing(el, st);
			var lineHeight = parseFloat(st.getPropertyValue("line-height"));
			if(isNaN(lineHeight)){
				lineHeight = 2 + parseFloat(st.getPropertyValue("font-size"));
				console.assert(!isNaN(lineHeight), "We couldn't figure font-size", st.getPropertyValue("font-size"), window.__el2stringForDiagnostics(el));
			}
			const elCleanTxt = window._cutInvisCharExceptSpaces(window._getVisInnerTxt(el)); // FIXME: we shouldn't cut invisible chars, but split on them <== No, actually we don't need to -- innerText already compresses invisible characters to single spaces
			// const elCleanTxt = el.textContent.trim();
			const wrdSp = __minZero(lineHeight * wordSpacing * (elCleanTxt.split(" ").length  - 1)); // -1 because we have an extra word for each break between words
			console.assert(!isNaN(wrdSp), "Couldn't get word white spacing for", window.__el2stringForDiagnostics(el));
			accu += wrdSp;
			// d - Between letter spacing
			var letterSpacing = parseFloat(st.getPropertyValue("letter-spacing"));
			if(!isNaN(letterSpacing)){
				accu += lineHeight * letterSpacing * (elCleanTxt.length - 1);
				// otherwise nothing to add - letterSpacing is "normal", i.e., zero
			}
			return accu;
		}, 0);
		return {txtWhiteSpace: txtWhiteSpace, flexWhiteSpace: flexSpace, paddingMaringSpace: paddingMaringSpace};
	}

	function __produceBBoxRes(jqColl, type = null){
		// Service F; for a uniform format of BBox result recording; Inteded for Primitives only
		return jqColl.toArray().map(el=>{
			const resObj = {
				type: el._gType || type, // we should have _gType defined for graphical elements
				tag: el.tagName.toLowerCase()
			};
			console.assert(resObj.type !== null, "We didn't assign a type to a primitive element ==> debug!", el.outerHTML, window.location.href);
			Object.assign(resObj, el._bbox || window._getAbsBoundingRectAdjForParentOverflow(el));
			return __addElIdToObj(el, resObj);
		});
	}

	function __produceCmpStyleRes(jqColl, settings = {noStylingCss: false, recalcNoStyling: false}){
		// Service F; assigns compupted properties to a resultObjArr
		const props2Record = window.__getAllCssPropList({excludePrefixed: true});
		if(settings.noStylingCss && settings.recalcNoStyling){
			window.toggleCssStyling("off");
		}
		const resObjArr = jqColl.toArray().map(el=>{
			var res;
			if(settings.noStylingCss && !settings.recalcNoStyling){
				// some element may have been added after we recorded noStylingCss <-- e.g., out clean spans <== Finding the 1st ancestor with noStylingCss
				let elWithNoStyleCss = el;
				while(elWithNoStyleCss && elWithNoStyleCss._noStylingCmpCSS === undefined){
					elWithNoStyleCss = elWithNoStyleCss.parentElement;
				}
				res = {actualElStylesTakenId: elWithNoStyleCss?window._getElId(elWithNoStyleCss):"NA"};
				if(!elWithNoStyleCss){
					console.error("elWithNoStyleCss was searched all the way to root -- no _noStylingCmpCSS was found ==> Debug. Meantime, returning undefined for all styles");
					Object.assign(res, Object.fromEntries(props2Record.map(k=>[k, "NA"])));
				}else{
					Object.assign(res, window.__cssValsToObj(elWithNoStyleCss._noStylingCmpCSS, props2Record));
				}
			}else{
				const st = window.getComputedStyle(el);
				// const res = window.__cssValsToObj(st, [...st]);
				res = window.__cssValsToObj(st, props2Record);
				// NEW HACKY addition -- using the original transition property <-- because I can't reenable Animations until all data collected (messes up with visibility sometimes)
				if(el._origCmpCSS){
					Object.assign(res, el._origCmpCSS);
				}	
			}
			// END NEW addition
			return __addElIdToObj(el, res);
		});
		if(settings.noStylingCss && settings.recalcNoStyling){
			window.toggleCssStyling("on");
		}
		return resObjArr;
	}


	function sampleMainTexts(elArrArr){
		// samples main text for in a convinient form for later analyses; Separate from recording mainTxt as groups
		return elArrArr.map(function (elArr) {
			console.assert(elArr._id, "We should have assigned ids to paragraph groups", window.location.href);
			return elArr.map(el=>{
				var text = window._getFullTextCleanAllButSpaces(el);
				return __addElIdToObj(el, {
					length: text.length,
					text: text,
					grId: elArr._id
				});
			});
		}).flat();
	}

	function getTextsAndOldStylesAsync(jqEls){
		const resultStore = [];
		//Record text primites, their text, their origTag and some of the old computed properties
		return jqEls.toArray().reduce((p, el)=>{
			return p.then(()=>{
				const res = {
					tag: el.tagName.toLowerCase(),
					origTag: el._origElTag || "NA",
					txt: window._getFullTextCleanAllButSpaces(el)
				};
				return extractOldFontPropsAsync(el).then(otherResObj=>{
					resultStore.push(__addElIdToObj(el, Object.assign(res, otherResObj)));
				});
			});
		}, Promise.resolve()).then(()=>{
			return resultStore;
		});
	}

	function __addElIdToObj(el, resultObj){
		// console.assert(el._id !== undefined, "Found an element without an assigned _id, el:", el.tagName, el.classList.join("."), el.id, window.location.href);
		// resultObj._id = el._id;
		resultObj._id = window._getElId(el);
		return resultObj;
	}

	function putImagesInArrayAsync(){
		return window.requestCatGraphObjArr().then(grObjArr=>{
			// Only saving non-zero images
			return grObjArr.filter(grObj=>{
				return ![window.graphTypes.zero, window.graphTypes.bgZero].includes(grObj.type);
			}).map(grObj=>{
				const b = grObj.b;
				return {
					name: [grObj.el.tagName.toLowerCase(), "id" + grObj.el._id, grObj.type, ... [b.top, b.left, b.width, b.height].map(Math.round)].join("_"),
					dat: window.__cnvs2DataUrl(grObj.cnvs)
				};				
			});
		});
	}

	function extractOldFontPropsAsync(el){
		const respObj = {};
		const st = window.getComputedStyle(el);
		// 1 - Font Weight
		// note: font weight seems to always resolve to a number
		const fw = parseInt(st.fontWeight);
		console.assert(!isNaN(fw), "Not a numeric font weight: ", st.fontWeight, window.location.href);
		respObj._oldFontThin = fw <= 300;
		respObj._oldFontBold = fw >= 500;
		// 2 - Decoration
		const textDecor = st.textDecorationLine;
		respObj._oldUnderlineExtraLine = textDecor !== "none";
		// 3 - Font styles
		const fontStyle = st.fontStyle;
		respObj._oldItalic = fontStyle === "italic" || fontStyle === "oblique";
		// 4 - Font family
		respObj._oldFontFam = st.fontFamily;
		// 5 - Line Spacing
		respObj._oldLineSpace = _getBtwLineSpace(el, st);
		// 6 - Text Aligning
		respObj._oldTextAlign = _measureTextAlignOLD(el, st);
		// 7 -  Width in pixels
		const onlyTextBBox = _measurePureTextWidthHeight(el, st, respObj._oldLineSpace);
		respObj._oldWidthInPix = onlyTextBBox.width;
		respObj._oldHeightInPix = onlyTextBBox.height;
		// 8 - Word spacing
		respObj._oldWordSpacing = __calcWordSpacing(el, st);
		// 8.1 - A bit of new addition -- letter-spacing (though probably nobody modifies these)
		respObj._oldLetterSpacing = __calcLetterSpacing(el, st);
		// 9 - BG color
		const cssTxtCol = window._cssCol2RgbaArr(st.color);
		 // txt color
		return window.getBgColorAsync(el, st, onlyTextBBox).then(bgColRgb=>{
			const colRgb = window.combineCssColorWithBgColor(cssTxtCol, bgColRgb);
			respObj._oldRgbTextCol = colRgb.join("_");
			respObj._oldRgbBgCol = bgColRgb.join("_");
			// 10 - Contrast
			// 10.1 - Convert to lab -- needed for AccessibilityStandard contrast calculation
			const colLab = window.rgbToLab(colRgb);
			const bgColLab = window.rgbToLab(bgColRgb);
			respObj._oldLabTextCol = colLab.join("_");
			respObj._oldLabBgCol = bgColLab.join("_");
			// 10.2 - Compute luminance contrast
			const MAXL = 100;
			respObj._oldLumContrast = ((Math.max(colLab[0], bgColLab[0]) / MAXL + 0.05) / (Math.min(colLab[0], bgColLab[0]) / MAXL + 0.05)).toFixed(3);
			// 10.3 - Computed RGB contrast/distance
			respObj._oldRgbContrast = _calcRgbContrast(colRgb, bgColRgb);
			return respObj;
		});
	}

	function __calcLetterSpacing(el, st = null){
		st = st || window.getComputedStyle(el);
		var lSpace = st.getPropertyValue("letter-spacing");
		if(lSpace === "normal"){
			lSpace = 0;
		}else{
			lSpace = parseFloat(lSpace);
			console.assert(!isNaN(lSpace), "Not a number letter-spacing value?..", st.getPropertyValue("letter-spacing"), window.__el2stringForDiagnostics(el));
		}
		return lSpace;
	}

	function __calcWordSpacing(el, st = null){
		st = (st || window.getComputedStyle(el));
		var wSpacing = st.getPropertyValue("word-spacing");
		const PERC_2_CH_RATIO = 0.55;
		if(wSpacing.indexOf("%") > -1){
			// temporarely set it ch units
			const newWSpacingVal = parseFloat(wSpacing) / 100 * PERC_2_CH_RATIO;
			console.assert(!isNaN(newWSpacingVal), "Not a number word-spacing value?..", st.wordSpacing, window.__el2stringForDiagnostics(el));
			window.__setCSSPropJqArr([el], "word-spacing", newWSpacingVal + "ch", "important");
			wSpacing = st.getPropertyValue("word-spacing"); // we don't have to re-compute computedStyle - it's a live object
			window.__restoreCSSPropJqArr([el], "word-spacing");
		}
		wSpacing = parseFloat(wSpacing);
		console.assert(!isNaN(wSpacing), "Computed Word spacing is not a number! Unexpected for FF! st.wordSpacing: ", st.wordSpacing, window.__el2stringForDiagnostics(el));
		return wSpacing;
	}

	function _calcRgbContrast(col1, col2){
		// Euqlidian distance --- absolute values...
		const r = Math.pow(col1[0] - col2[0], 2);
		const g = Math.pow(col1[1] - col2[1], 2);
		const b = Math.pow(col1[2] - col2[2], 2);
		return Math.sqrt((r + g + b) / 3).toFixed(1);
	}

	function _measureTextAlignOLD(el, st) {
		if(st["textAlign"] === "start"){
			return (st["direction"] === "ltr")?"left":"right";
		}
		if(st["textAlign"] === "end"){
			return (st["direction"] === "ltr")?"right":"left";
		}
		return st["textAlign"];
	}

	// NOTE: Why paragraphs? ==> We get individual bboxes for para textNodes instead of a parent element -- a parent may contain other elements, like images etc.
	// TODO: record the texts per paragraph and num of lines - some textNodes may be filtered out eventually, so we can't simply rely on group membership
	function sortTxtNodesInMultiLineParagraphs(jqEls){ //NOTE: No controls in jqEls; no computed controls
		// NOTE: there is no good/simple/non-maddening-at-debug way to detect what is rendered as inline (e.g., see flexbox) ==> use a heuristic: all 'oficially' block-level tag, are block level (if the dev explicitly made them display:inline or so, it's not our problem -- they are 'semantically' should be blocks/paragraphs of content)
		const elArr = jqEls.toArray();
		const blockTags = window._tagSets.displayBlockTags;
		const diplayBlockAncestors = Array.from(new Set(elArr.map(_el => {
			var el = _el;
			// look up until meeting non-inline element
			while(el !== null && !blockTags.has(el.tagName.toLowerCase())){
				// searching up until <html> or a display:block ancestor
				el = el.parentElement;
			}
			return el;
		}).filter(x=>x!==null)));
		// map textNodes to ancestors/paragraphs
		const paraAsTextNodeArrArr = diplayBlockAncestors.map(ancestor=>{
			return {ancestor: ancestor, textNodes: elArr.filter(el=>{
				return ancestor.contains(el);
			})};
		});
		// resolve nested paragraphs -- cut 'smaller'/internal paragraphs out of external
		paraAsTextNodeArrArr.forEach(paraObj => {
			// a - looking through ancestors to see if anything is nested in the current one
			paraAsTextNodeArrArr.forEach(anotherParaObj=>{
				if(paraObj === anotherParaObj || !paraObj.ancestor.contains(anotherParaObj.ancestor)){
					return;
				}
				// b - anotherParaObj is nested in paraObj -- do the cutting
				paraObj.textNodes = paraObj.textNodes.filter(txtNode=>{
					if(anotherParaObj.textNodes.includes(txtNode)){
						return false; // if a textNode is in the nested para (aka, anotherParaObj), we filter it out from the higher-level para (aka, paraObj)
					}
					return true;
				});
			});
		});
		// fool check -- DISABLE AFTER DEBUG
		const __beenTaken = new Set();
		paraAsTextNodeArrArr.forEach(paraObj => {
			console.assert(paraObj.textNodes.length, "We have an empty ancestor?...", paraObj.ancestor.outerHTML, window.location.href);
			paraObj.textNodes.forEach(txtNode=>{
				console.assert(!__beenTaken.has(txtNode), "A text node appears in more than 1 ancestor collection", window.location.href);
				__beenTaken.add(txtNode);
			});
		});
		// check if textNode height/width change if we add a long string to it; If not, their width/height are hardcoded -- exclude them
		paraAsTextNodeArrArr.forEach(paraObj => {
			paraObj.textNodes = paraObj.textNodes.filter(txtNode=>{
				const origBbox = txtNode.getBoundingClientRect();
				// a - remove all text -- should be zero-sized bbox - even if it grows with 'b', we still can't be sure of how many lines of text we are starting from <-- exclude such items
				const textContent = txtNode.textContent;
				txtNode.textContent = "";
				const emptyBbox = txtNode.getBoundingClientRect();
				// b - add a lot of content
				txtNode.textContent = textContent + ciceroText;
				// const largeBbox = txtNode.getBoundingClientRect();
				const largeBbox = window._getAbsBoundingRectAdjForParentOverflow(txtNode, true, true); // we should control for parent's overflow hiding the content -- thus adjusted bbox needed
				// c - restore content
				txtNode.textContent = textContent;
				// fool check - by this point we presume that there are no naked textNodes, so it's safe to expect emptyBbox to be 0 sized
				// TODO: remove after // DEBUG: 
				txtNode.childNodes.forEach(x=>console.assert(x.nodeType === document.TEXT_NODE), "We have a non-document.TEXT_NODE insude a supposedly pure-text node", txtNode.outerHTML, window.location.href);
				// d - check if a) emptyBbox was empty, and b) sizes changed with content
				return (emptyBbox.width === 0 || emptyBbox.height === 0) && (origBbox.width !== largeBbox.width || origBbox.height !== largeBbox.height);
			});
		});
		// filter out paragraphs that don't have anything in them that changes size -- no point counting lines for this, and not really possible with our approach
		const nonEmptyParaObjArr = paraAsTextNodeArrArr.filter(paraObj=>{
			return paraObj.textNodes.length;
		});
		// NOTE: We shouldn't replace <br> - if it's a split, it's a split, regardless of how little space between paragraphs there is
		// // 0 - find <br> and replace them with empty spans - unless they are more than one siblin <br> (prep a candidate collection)
		// const brToRepl = new Set(...nonEmptyParaObjArr.map(paraObj=>{
		// 	return Array.from(paraObj.ancestor.querySelectorAll("br")).filter(brEl=>{
		// 		return !(__isItBr(brEl.previousSibling) || __isItBr(brEl.nextSibling));
		// 	});
		// }));
		// const brSpanPairsToRestore = Array.from(brToRepl).map(brEl=>{
		// 	console.assert(document.body.contains(brEl), "A <br> element isn't in DOM anymore... We were supposed to have a unique collection of br elements...", window.location.href);
		// 	const span = window.__makeCleanSpan();
		// 	brEl.replaceWith(span);
		// 	return {span: span, brEl: brEl};
		// });
		// 1 - Split multi-paragraph items in multiple paragraphs
		const paraObjArr = nonEmptyParaObjArr.map(paraObj=>{
			// 2- if we only have 1 textNode, do nothing
			if(paraObj.textNodes.length === 1){
				return [paraObj.textNodes];
			}
			// 2.1 - Otherwise split
			const run1Clust = __els2clustersByBbox(paraObj.textNodes);
			// 2.2 - Add a bit of text to each element - to make sure we don't have 'lucky' paragrphs due to a new element accidentally beginning on a new line
			const txtCont2RestoreArr = paraObj.textNodes.map(txtNode=>{
				const txt = txtNode.textContent;
				txtNode.textContent += "some word";
				return {oldTxt: txt, txtNode: txtNode};
			});
			const run2Clust = __els2clustersByBbox(paraObj.textNodes);
			// 2.3 - Restore text
			txtCont2RestoreArr.forEach(x => {
				x.txtNode.textContent = x.oldTxt;
			});
			// 2.4 - return a clust arr with fewer items
			return (run1Clust.length>run2Clust.length)?run2Clust:run1Clust;
		}).reduce((a, x)=>a.concat(x), []); // flattening array -- so it's an array of arrays
		// 3 - Prep paragrphs for saving
		const paraAsCollOfNodes = paraObjArr.map(txtNodes=>{
			return {_id: window._generateId(), nodes: txtNodes};
		});
		// 4 - Count lines; Combine texts; Record bbox; Record betweenLineSpacing (no, we'll rely on individual pieces/nodes)
		const paraRes2Save = paraAsCollOfNodes.map(paraObj=>{
			const paraRes = {_id: paraObj._id};
			paraRes.txt = paraObj.nodes.reduce((accu, node)=>{
				return accu += window._getFullTextCleanAllButSpaces(node);
			}, "");
			// get an encompassing bbox - for the inline/actual-text parts of elements
			const {nodes2unwrap, inlineNodes} = __blockNodes2InlineNodes(paraObj.nodes);
			Object.assign(paraRes, __getInnerBBoxForNodeCollection(inlineNodes));
			nodes2unwrap.forEach((item, i) => __unwrapBlockElContentsFromSpans(item));
			Object.assign(paraRes, __countTextLines(paraObj.nodes));
			// use most-common font size to measure para width in characters
			// TODO: measure width separately for each column
			paraRes.widthInChars = _getParaWidthInChar(paraObj.nodes, paraRes);
			return paraRes;
		});
		// 4 - Record each cluster as a paragraph
		return {paraAsCollOfNodes: paraAsCollOfNodes, paraRes2Save: paraRes2Save};
	}
	
	function __blockNodes2InlineNodes(nodes){
		// display:block nodes have their content wrapped in spans, and these spans returned instead; Inline elements are unchanged <-- Used to get the bbox of actual text, and not a display:block element
		const nodes2unwrap = [];
		const inlineNodes = nodes.map(el=>{
			
			const st = window.getComputedStyle(el);
			if(st.display !== "inline" && st.display !== "inline-list"){
				__wrapBlockElContentsInSpan(el);
				nodes2unwrap.push(el);
				return Array.from(el.childNodes);
			}
			return el;
		}).flat();
		return {nodes2unwrap: nodes2unwrap, inlineNodes: inlineNodes};
	}
	
	// if(inlineSize && (st.display !== "inline" && st.display !== "inline-list")){
	// 	__unwrapBlockElContentsFromSpans(pNode);
	// }

	function _getParaWidthInChar(paraNodes, bbox){
		// find 1st element with most common size
		const fontSizesObj = {};
		const nodes2fontSizesObj = {}; // storing referneces to nodes of the 1st occurence of each font size
		paraNodes.forEach(node=>{
			const fontSize = Math.round(parseFloat(window.getComputedStyle(node).fontSize));
			console.assert(!isNaN(fontSize), "Font sizes weren't a number: ", window.getComputedStyle(node).fontSize, window.location.href);
			fontSizesObj["_"+fontSize] = ((fontSizesObj["_"+fontSize]===undefined)?0:fontSizesObj["_"+fontSize]) + node.innerText.length;
			if(nodes2fontSizesObj["_"+fontSize] === undefined){
				nodes2fontSizesObj["_"+fontSize] = node;
			}
		});
		const mostCommonSize = Object.keys(fontSizesObj).sort((a, b)=>{
			if(fontSizesObj[a] > fontSizesObj[b]){
				return -1;
			}
			if(fontSizesObj[b] > fontSizesObj[a]){
				return 1;
			}
			return 0;
		})[0];
		// estimate width in char
		return __measureWidthInChar(bbox.width, window.getComputedStyle(nodes2fontSizesObj[mostCommonSize]));
	}

	function __measureWidthInChar(width, styleObj2Cpy){
		// OPTIMIZE: create a span only once, not every time we measure width
		// make a span with Text properties identical to the targetObj
		const span = window.__makeCleanSpan();
		const st2cpy = window.__cssValsToObj(styleObj2Cpy, span.__inheritedProps);
		st2cpy.display = "block"; // enforcing this, so it occupies the whole page width
		window.__enforceCSSVals(span, st2cpy);
		// keep adding characters until exceed 'width'
		document.body.appendChild(span);
		const charArr = Array.from(ciceroText);
		while(span.getBoundingClientRect().width < width && charArr.length){
			span.textContent += charArr.shift();
		}
		var res = "NA";
		if(!charArr.length){
			console.warn("We were unable to measure width in characters, width: ", width, " bodyWidth:", document.body.scrollWidth, "styles:", JSON.stringify(st2cpy), window.location.href);
			debugger;
		}else{
			res = span.textContent.length;
		}
		// remove span
		document.body.removeChild(span);
		return res;
	}

	function __wrapBlockElContentsInSpan(node){
		node.childNodes.forEach(aTxtNode => {
			console.assert(aTxtNode.nodeType === document.TEXT_NODE, "We wouldn't expect non TEXT_NODE nodes in our textNode collections at this point ---> debug, ", node.outerHTML, window.location.href);
			const aSpan = window.__makeCleanSpan();
			aSpan.textContent = aTxtNode.nodeValue;
			aSpan._origTxtNode = aTxtNode;
			aTxtNode.replaceWith(aSpan);
			// tmpSpanTxtPairs.push({span: aSpan, txt: aTxtNode});
		});
	}

	function __unwrapBlockElContentsFromSpans(node){
		node.childNodes.forEach(aSpan => {
			console.assert(aSpan.tagName.toLowerCase() === "span" && aSpan._origTxtNode !== undefined, "We can't unwrap a span out of an element ---> debug, ", node.outerHTML, window.location.href);
			aSpan.replaceWith(aSpan._origTxtNode); // Let it fall if aSpan._origTxtNode is undefined
		});
	}

	function __countTextLines(nodes){
		const toleranceThr = 5; // px -- anything within this counts as the same line
		// for each not inline or "inline-list" node, temporarily wrap their texts in empty spans
		// const tmpSpanTxtPairs = [];
		const tmpInSpannedNodes = [];
		const allInlineNodes = nodes.map(node=>{
			const dispProp = window.getComputedStyle(node).getPropertyValue("display");
			if(dispProp === "inline" || dispProp === "inline-list"){
				return [node]; // no need to wrap in spans
			}
			__wrapBlockElContentsInSpan(node);
			tmpInSpannedNodes.push(node);
			// node.childNodes.forEach(aTxtNode => {
			// 	console.assert(aTxtNode.nodeType === document.TEXT_NODE, "We wouldn't expect non TEXT_NODE nodes in our textNode collections at this point ---> debug, ", node.outerHTML, window.location.href);
			// 	const aSpan = window.__makeCleanSpan();
			// 	aSpan.textContent = aTxtNode.nodeValue;
			// 	aTxtNode.replaceWith(aSpan);
			// 	tmpSpanTxtPairs.push({span: aSpan, txt: aTxtNode});
			// });
			return Array.from(node.childNodes);
		}).reduce((a, x)=>a.concat(x), []); // removing 1 level of depth from array
		// count individual top/y for getClientRects <-- allow for a few pixels of fuzziness
		const clientRects = [... new Set(allInlineNodes.map(aNode=>{
			return Array.from(aNode.getClientRects()).map(window.__cpyBBox);
		}).reduce((a, x)=>a.concat(x), []))].sort((a, b)=>{
			if(a.top < b.top){
				return -1;
			}
			if(a.top > b.top){
				return 1;
			}
			return 0;
		});
		// lines and their length
		const lines = clientRects.reduce((accu, rect)=>{
			if(!accu.length){
				accu.push(rect); // 1st element
				return accu;
			}
			const currLine = accu[accu.length-1];
			if((rect.top - currLine.top) < toleranceThr){
				// same line -- adjust width
				currLine.left = Math.min(currLine.left, rect.left);
				currLine.right = Math.max(currLine.right, rect.right);
			}else{
				// new line
				accu.push(rect);
			}
			return accu;
		}, []); // clientRects.shift() <-- No, we need this array untouched for column counting
		//TODO: count columns; return them as an array; with separate width for each;
		// OPTIMIZE: try to get actual column width -- for now we just presume it's fullWidth/numColumns
		var columnsCount = 1;
		if(lines.length > 1){
			// we may have more than one columns
			var colMergeRes = __mergeRectsInCol(clientRects);
			var __counter = 0;
			while(colMergeRes.mergingHappened){
				colMergeRes = __mergeRectsInCol(colMergeRes.colsArr);
				if(++__counter > 1000){
					throw new Error("Probably an issue with mergin --> DEBUG it" + window.location.href);
				}
			}
			columnsCount = colMergeRes.colsArr.length;
		}
		const resObj = {
			uniqueLinesCount: lines.length,
			columnsCount: columnsCount,
			combinedLinesWidth: lines.reduce((accu, rect)=>accu + (rect.right - rect.left), 0)
		};
		// restore replacements back
		tmpInSpannedNodes.forEach(__unwrapBlockElContentsFromSpans);
		// tmpSpanTxtPairs.forEach(pair => {
		// 	pair.span.replaceWidth(pair.txt);
		// });
		// return
		return resObj;
	}

	function __mergeRectsInCol(clientRects){
		var mergingHappened = false;
		const colsArr = clientRects.reduce((accu, rect)=>{
			// if accu contains a column that overlaps with the current rect, enlarge the column and move one; otherwise add a new column
			const col = accu.find(col=>{
				return __do2XIntervalOverlap(col, rect);
			});
			if(col !== undefined){
				mergingHappened = true;
				col.left = Math.min(col.left, rect.left);
				col.right = Math.min(col.right, rect.right);
			}else{
				accu.push({left: rect.left, right: rect.right});
			}
			return accu;
		}, []);
		return {mergingHappened: mergingHappened, colsArr: colsArr};
	}



	function __do2XIntervalOverlap(intervLeft, intervRight){
		const direction = "X";
		return window.__do2intervalsOverlap(intervLeft, intervRight, direction);
		// function __pointWithinInterv(x, interval){
		// 	return x >= interval.left && x <= interval.right;
		// };
		// return __pointWithinInterv(intervLeft.left, intervRight) || __pointWithinInterv(intervRight.left, intervLeft);
	}

	function __getInnerBBoxForNodeCollection(nodes){
		// gets the min size rectangle that encompasses/wraps around all elements in a collection
		const innerBboxes = nodes.map(node=>window._getInnerBBox(node));
		return __bboxArr2singleBbox(innerBboxes);
	}

	function __bboxArr2singleBbox(innerBboxes){
		if(!innerBboxes.length){
			debugger;
		}
		console.assert(innerBboxes.length, "Several bboxes needed", window.location.href);
		const resBbox = {
			top: Math.min(... innerBboxes.map(x=>x.top)),
			bottom: Math.max(... innerBboxes.map(x=>x.bottom)),
			left: Math.min(... innerBboxes.map(x=>x.left)),
			right: Math.max(... innerBboxes.map(x=>x.right))
		};
		resBbox.height = resBbox.bottom - resBbox.top;
		resBbox.width = resBbox.right - resBbox.left;
		resBbox.x = resBbox.left;
		resBbox.y = resBbox.top;
		return resBbox;
	}

	function __els2clustersByBbox(elArr){ // F to split multiple paragraphs within an element in separate paragraphs -- as collections of textNodes
		const txtNodeArrCopy = elArr.slice();
		const clustArrArr = [];
		// 2 - Keep joining bboxes of textNodes based on overlapping top/bottom, until we have all textNodes assigned to a clusters
		// 2.1 - Each join restarts measuresment
		// 2.2 - If no nodes can be added, but some nodes are still left, create another cluster and repeated
		while(txtNodeArrCopy.length){
			const currClustElArr = [txtNodeArrCopy.shift()];
			const _tmpBbox = _getInnerBBoxAdjForBtwLineSpace(currClustElArr[0]);
			const currClustBbox = { // intializing our "cluster"
				top: _tmpBbox.top,
				bottom: _tmpBbox.bottom
			};
			var elI2add = -1;
			while(elI2add = __findOneBbox2AddInCluster(currClustBbox, txtNodeArrCopy) !== -1){
				// splice arrays
				const el2add = txtNodeArrCopy.splice(elI2add, 1)[0];
				// save the found element in a 'cluster'
				currClustElArr.push(el2add);
				// change bBox
				const elI2addBbox = _getInnerBBoxAdjForBtwLineSpace(el2add);
				currClustBbox.top = Math.min(currClustBbox.top, elI2addBbox.top);
				currClustBbox.bottom = Math.max(currClustBbox.bottom, elI2addBbox.bottom);
				// repeat
			}
			// we're done constructing a cluster ==> push this cluster in clustArrArr
			clustArrArr.push(currClustElArr);
		}
		return clustArrArr;
	}

	function _getInnerBBoxAdjForBtwLineSpace(txtNode){
		// A) increases innerBBox to include beetweenLine and betweenWord Spacing
		// B) wraps contents of display:block elements in spans -- so bbox only wraps around actual text, and not full length of an element -- because block elements occupy the whole line
		// NOTE: only to be used while clustering textNodes in  paragraphs
		var enlargeByX = 2;
		// var enlargeByY = 2; // px -- at least 1px so bboxes overlap
		const st = window.getComputedStyle(txtNode);
		var bbox, blockBBox;
		if(st.display !== "inline" && st.display !== "inline-list"){
			__wrapBlockElContentsInSpan(txtNode);
			const _chld = Array.from(txtNode.childNodes);
			bbox  = __getInnerBBoxForNodeCollection(_chld);
			window.__setCSSPropJqArr(_chld, "display", "inline-block", "important");
			blockBBox = __getInnerBBoxForNodeCollection(_chld);
			window.__restoreCSSPropJqArr(_chld, "display");
			__unwrapBlockElContentsFromSpans(txtNode);
		}else{
			bbox = window._getInnerBBox(txtNode);
			window.__setCSSPropJqArr([txtNode], "display", "inline-block", "important");
			blockBBox = window._getInnerBBox(txtNode);
			window.__restoreCSSPropJqArr([txtNode], "display");
		}
		// We need to add line-heigh in any case -- because we always get bboxes for inline elemements <-- No, we replace this with choosing a larger-height bbox between inline and block bboxes <-- inline elements only partially respect line-height
		// enlargeByY += _getBtwLineSpace(txtNode, st);
		enlargeByX += __calcWordSpacing(txtNode, st) + __calcLetterSpacing(txtNode, st);
		if(blockBBox.height > bbox.height){ // sometimes a block-element bbox can be smaller than its content <-- if line-height is too small, e.g., smaller than ~fontSize*1.38
			bbox.top = blockBBox.top;
			bbox.bottom = blockBBox.bottom;
			bbox.height = blockBBox.height;
		}
		// bbox.top -= enlargeByY;
		// bbox.bottom += enlargeByY;
		// bbox.height += 2 * enlargeByY;
		bbox.left -= enlargeByX;
		bbox.right += enlargeByX;
		bbox.width += 2 * enlargeByX;
		bbox.x = bbox.left;
		bbox.y = bbox.top;
		return bbox;
	}

	function _getBtwLineSpace(el, st = undefined){
		if(st === undefined){
			st = window.getComputedStyle(el);
		}
		
		const lH = st.getPropertyValue("line-height");
		if(lH === "normal"){
			return 0; // it seems at least 1px of between-line spacing is always present <-- not really, reverting back to 0
		}
		const btwLSp = (parseFloat(lH) - parseFloat(st.getPropertyValue("font-size"))) / 2;
		console.assert(!isNaN(btwLSp), "Can't calculate betweenLineSpacing for these values, line-height:", lH, "font-size: ", st.getPropertyValue("font-size"), el.outerHTML, window.location.href);
		return btwLSp;
	}

	function __findOneBbox2AddInCluster(clustBbox, txtNodeArr){
		// service F for joining text nodes in a cluster that is eventually counted as a paragraph
		return txtNodeArr.findIndex(el=>{
			const elBbox = _getInnerBBoxAdjForBtwLineSpace(el);
			// NOTE: texts should touch in at least one directions
			return window._do2bboxesOverlap(clustBbox, elBbox);
			// OLD solution below -- cut later			
			// if((elBbox.top >= clustBbox.top && elBbox.top < clustBbox.bottom) || (elBbox.bottom > clustBbox.top && elBbox.bottom <= clustBbox.bottom)){
			// 	return true; // we have an overlap on the Y axis --> add this element in a cluster
			// }
			// return false;
		});
	}

	function _measurePureTextWidthHeight(el, st = null, btwLineSpace){
		// OPTIMIZE: this F duplicates __wrapBlockElContentsInSpan + __unwrapBlockElContentsFromSpans
		// FIXME: MAY NOT WORK if a node contains several textNodes -- it's possible, maybe
		// measures the width/height of text for Block-level elements, just text, not the entire bbox
		if(st === null){
			st = window.getComputedStyle(el);
		}
		var bbox, node2repl, txtVal;
		if(el.childNodes.length === 0 || window._tagSets.controls.has(el.tagName.toLowerCase())){
			// this is a control <-- we can't embed a span inside it, but we could replace it with a span
			txtVal = el.value || el.placeholder || el.innerText;
			node2repl = el;
			// <option> can't be replaced with a span -- replacing the parent <select> instead
			if(el.tagName.toLowerCase() === "option"){
				node2repl = el.parentElement;
			}
		}else{
			console.assert(el.childNodes.length === 1, "We expect all elements to have only 1 non-wrapped textNode in it, ", el.outerHTML, window.location.href);
			node2repl = el.childNodes[0];
			txtVal = node2repl.nodeValue;
		}
		// TODO: use window._getTextNodeBBox instead of this span embedding
		// Wrap textContent in a span, and measure it's dims <-- we don't have to do it for display === inline/inline-list, but it's just simpler -- avoid margins/padding/border
		const span = window.__makeCleanSpan();
		span.textContent = txtVal;
		node2repl.replaceWith(span);
		// record the bbox of the clean span -- it should wrap around the text with nothing added -- so pure width/height <== // DEBUG: check this
		bbox = span.getBoundingClientRect();
		if(bbox.height <= 0 || bbox.width <= 0){
			// For some fonts measurements fail -- no idea why
			window.__setCSSPropJqArr([span], "font-family", "Times", "important");
			bbox = window.__cpyBBox(span.getBoundingClientRect());
			window.__restoreCSSPropJqArr([span], "font-family");
			if(bbox.height <= 0 || bbox.width <= 0){
				console.warn("Zero-sized text. Debug. Returning element's bbox instead of its text's bbox.", window.__el2stringForDiagnostics(el));
				debugger;
				bbox = window._getFloatProofBBox(el);
			}else{
				console.warn("[PAGE.PARAMS] Weird font is causing textNode to be computed as zero-sized", window.__el2stringForDiagnostics(el));
			}
		}
		// restoring the text node
		span.replaceWith(node2repl);
		return window.__cpyBBox(bbox);
		// if(el.childNodes.length === 0 || window._tagSets.controls.has(el.tagName.toLowerCase())){
		// 	// this is a control <-- we can't embed a span inside it
		// 	var bbox = window._getInnerBBox(el);
		// 	if(bbox.width === 0 || bbox.height === 0){
		// 		// in case an element is styled to have colored/bgImg padding
		// 		bbox = window.__cpyBBox(el.getBoundingClientRect());
		// 	}
		// 	bbox.top = bbox.y = bbox.top + btwLineSpace;
		// 	bbox.bottom -= btwLineSpace;
		// 	bbox.height -= btwLineSpace * 2;
		// 	return bbox;
		// }
		// // Wrap textContent in a span, and measure it's dims <-- we don't have to do it for display === inline/inline-list, but it's just simpler -- avoid margins/padding/border
		// const span = window.__makeCleanSpan();
		// const txtNode = el.childNodes[0];
		// span.textContent = txtNode.nodeValue;
		// txtNode.replaceWith(span);
		// // record the bbox of the clean span -- it should wrap around the text with nothing added -- so pure width/height <== // DEBUG: check this
		// bbox = span.getBoundingClientRect();
		// // restoring the text node
		// span.replaceWith(txtNode);
		// return window.__cpyBBox(bbox);
	}

	function _primElArr2Dict(primElArr){
		// returns a dictionary (aka, an object) with _ids of elements as keys and elements as values
		return Object.fromEntries(primElArr.map(el=>[el._id, el]));
	}

	function _mapIdsOnEls(primElDict, clustResArr){
		// idArrArr is the output of R's clustering -- array of arrays of _ids; We need to convert these ids back to elements
		//idArrArr format: [{_row: id, clustDatType1: clustId, ...}]
		console.assert(clustResArr.length, "No elements in a cluster array result? Debug.", location.href);
		if(!clustResArr.length){
			return [];
		}
		const clustDatTypes = Object.keys(clustResArr[1]).filter(x=>x!=="_row");
		return Object.fromEntries(clustDatTypes.map(clustDatType=>{
			const outArrArr = []; // arr of arr of elements; each subArr is a cluster/group to be saved
			clustResArr.forEach((clustObj, i) => {
				const thisElClustId = clustObj[clustDatType];
				const thisElId = clustObj["_row"];
				if(thisElClustId > 0){ // checking for unassigned primitives
					if(!outArrArr[thisElClustId]){
						outArrArr[thisElClustId] = []; // initializing a cluster
					}
					console.assert(primElDict[thisElId] !== undefined, "An unknown element id was returned from R after clustering: ", thisElId);
					outArrArr[thisElClustId].push(primElDict[thisElId]);
				}else{
					console.warn("No-cluster primitive", clustObj["_row"]);
				}
			});
			return [clustDatType, outArrArr.filter(x=>x)]; // .filter to make sure we have no emptySlot elements
		}));
	}

	function __sampleSeedsForRootSearch(elArr, fraction = 0.5, minSeeds = 2){
		// randomly selects elements from elArr to serve as 'seeds' - primitives to look up from in the search of R's cluster roots
		if(fraction === 1){
			return elArr; // take all
		}
		const n = Math.max(Math.ceil(elArr.length)*fraction, minSeeds);
		if(n >= elArr.length){
			console.warn("Asked for more seeds than we had elements in a cluster array --> returning full array; n:", n, "elArr.length:", elArr.length, window.location.href);
			return elArr;
		}
		return window._sampleFromArr(elArr, n);
	}

	function _getCostBenefitForOneSeed(seedEl, clustArrI, elArrArr){
		// NOTE: larger clusters should have a higher tolerance for costs (actual nOverlap)
		// benefit: (1 - (1-fracIncl)^2)
		// cost: fracForeign^2 + fracOverlap^2
		// cost2: 1-1/exp((x)*4)) <-- seems reasonable for the range (x is largerly going to be close to zero; x is nOverlap/(clustSize*otherClustSize))
		// 0 - Prep data
		const elArr = elArrArr[clustArrI];
		const allNonMembEls = elArrArr.reduce((a, x, i)=>{
			if(i === clustArrI){
				return a;
			}
			return a.concat(x);
		}, []);
		// 1 - Do until 'null' or all clustEls are in the ancestor
		var currEl = seedEl; //.parentElement;
		var nonInclClustMemb = elArr.filter(el=>!currEl.contains(el));
		const costBenLadder = []; // keep records so we can have a look at how cost/benefit functions behave
		var shouldStopNow = false;
		while(currEl !== null && !shouldStopNow){
			shouldStopNow = nonInclClustMemb.length === 0; // using this V instead of nonInclClustMemb.length, so it runs for all-clustMembers-included cases once
			// 1.1 - Calc cost/benefit
			const benefit = (1 - (nonInclClustMemb.length/elArr.length)**2);
			const foreignMembs = allNonMembEls.filter(nonMembEl=>currEl.contains(nonMembEl));
			const fracForeign = foreignMembs.length / (foreignMembs.length + (elArr.length - nonInclClustMemb.length));
			const fracOverlap = foreignMembs.length / allNonMembEls.length;
			const cost = fracForeign ** 2 + fracOverlap ** 2;
			const membFrac = 1 - nonInclClustMemb.length/elArr.length; // n of clust memb -- to judge later on if it's a root at all or not
			costBenLadder.push({el: currEl, benefit: benefit, cost: cost, costBen: (benefit - cost), membFrac: membFrac});
			// 1.2 - Move up the 'ladder' -- to the immediate parent
			currEl = currEl.parentElement;
			if(currEl !== null){ // else we've reached HTML, nothing left to do
				nonInclClustMemb = elArr.filter(el=>!currEl.contains(el)); // initializing it here, so we do 
			}else{
				console.assert(nonInclClustMemb.length === 0, "nonInclClustMemb members left after we've reached HTML", nonInclClustMemb);
			}
		}
		return costBenLadder;
	}

	function _findElGroupRoots(elArrArr){
		// each subArray is a cluster from R -- do they have a meaningful root?
		// DEFINITION: meaningful root - // a) maximizes the number of cluster primitives included; b) minimizes overlap with other groups/clusters/other-cluster primitives 
		// Algorithm: 1) For each seed (aka, a chosen primitive), look up until all cluster elements are contained; 2) Record cost-benefit for each ancestor; 3) Choose the ancestor with the best cost-benefit as a root
		const SEED_FRACTION = 0.5;
		const MIN_SEEDS = 2;
		const MIN_CLUST_MEMBERSHIP_FOR_ROOT = 0.51;
		const MIN_CB_FOR_ROOT = 0.25; // if below, a root is a poor descriptor/fit for a cluster
		const costBenefitLaddersArrOrig = elArrArr.map((elArr, clustArrI)=>{
			const seeds = __sampleSeedsForRootSearch(elArr, SEED_FRACTION, MIN_SEEDS);
			// 1) For each seed (aka, a chosen primitive), look up until all cluster elements are contained;
			const costBenefitLadders = seeds.map(seedEl=>{
				return _getCostBenefitForOneSeed(seedEl, clustArrI, elArrArr);
			});
			return costBenefitLadders;
		});
		// 2) Filter NO ROOT condition: fewer than elArr.length/2 eventual members
		const costBenefitLaddersArr = costBenefitLaddersArrOrig.map(ladderArr=>{ // for each cluster
			return ladderArr.map(ladder=>{ // for each starting seed
				return ladder.filter(fitObj=>{
					// extra check -- if a potential root is collapsed due to floats etc. -- maybe there is a better non-collapsed root that is visible -- otherwise we can always fall back on the clustered items
					// const b = window._getFloatProofBBox(fitObj.el);
					const b = fitObj.el.getBoundingClientRect(); // native version here!
					return fitObj.membFrac >= MIN_CLUST_MEMBERSHIP_FOR_ROOT && fitObj.costBen >= MIN_CB_FOR_ROOT && (b.width * b.height > 0);
				}).filter((fitObj, i, arr)=>{
					// 2.1 - filter out same-costBenefit elements that are higher in HTML
					if(!i){
						return true; // 1st element
					}
					return fitObj.costBen !== arr[i-1].costBen; // only keep element if its costBenefit is different from the element before
				});
			});
		});
		// 3 - Find the highest cost/benefit (aka, fit) element for each cluster
		const roots = costBenefitLaddersArr.map(ladderArr=>{
			// 3.1 - concat all ladders for a cluster
			const joinedLadders = ladderArr.reduce((a, x)=>a.concat(x), []);
			// 3.2 - search for the best root
			if(!joinedLadders.length){
				return null; // no root for this cluster
			}
			return joinedLadders.sort((a, b)=>b.costBen-a.costBen)[0]; // if more than 1 element has the highest cb, we choose one at random -- due to how .sort works
		});
		return {roots: roots, costBenefitLaddersArrOrig: costBenefitLaddersArrOrig};
		// NOTE: How do we know which primitive to start from? We can't know in advance which one would give the best cost-benefit --> a) Re-calc for each element and measure time; b) If it's too computationally expensive --> sample randomly a proportion of starting primitives
	}

	function __prepClustGroups(elArrArr, roots, ifrStAloneArr){
		// Preps 3 types of post-R-clustering groups: groups as element collections; groups as roots; and mixed
		const idArr = (new Array(elArrArr.length + ifrStAloneArr.length)).fill().map((x, i)=>"ClustID_" + (i+1));
		// const MIN_GR_OVERLAP_SAME_GROUPS = 0.8; // proportion of elements
		const elArrArrCpy = elArrArr.map((elArr, i) => {
			elArr._thisIsARoot = false; // enforcing these on an array
			return elArr;
		}).concat(ifrStAloneArr.map(ifrEl=>{
			const res = [ifrEl];
			res._thisIsARoot = false;
			res._thisIsIFrame = true;
			return res;
		}));
		const mixedGroups = roots.map((x, i)=>{ // making it unique - in case 2 clusters had the same root <-- NO, we'll record all, and then see which elIds repeat
			const root = (x === null)?elArrArr[i]:x.el; // because x is a fitObj, not an element per se
			if(x === null){
				// we failed to find a root for this cluster --> use a cluster's elements instead
				// el._thisIsARoot = false; // These 2 are already set 
			}else{
				root._thisIsARoot = true; // setting these on elements, not arrays
			}
			return root;
		}).concat(ifrStAloneArr.map(ifrEl=>{
			ifrEl._thisIsARoot = true;
			ifrEl._thisIsIFrame = true;
			return ifrEl;
		}));
		// const noNullGroups = mixedGroups.filter(x=>x._thisIsARoot);
		// keep a reference to idArr <-- I can't set these on elements, because I prep all collections at once -- and collections share elements, so IDs get overwritten
		elArrArrCpy.idArr = idArr;
		mixedGroups.idArr = idArr;
		return {grAsNodeColl: elArrArrCpy, grMixed: mixedGroups, idArr: idArr};
	}

	function primitiveClusters2Data(clustListArr){
		// const dataTypesToRecord = ["dist_html_sum_hbrdCut", "dist_spat_l2_hbrdCut", "sim_spatConnect_gauss_hbrdCut", "dist_html_sum_dist_spat_l2_hbrdCut", "dist_html_sum_sim_spatConnect_gauss_hbrdCut", "dist_html_sum_mod_bgAndBrd_hbrdCut", "dist_spat_l2_mod_bgAndBrd_hbrdCut", "sim_spatConnect_gauss_mod_bgAndBrd_hbrdCut", "dist_html_sum_dist_spat_l2_mod_bgAndBrd_hbrdCut", "dist_html_sum_sim_spatConnect_gauss_mod_bgAndBrd_hbrdCut"];
		const dataTypesToRecord = ["dist_html_sum_hbrdCut", "dist_html_sum_sim_spatConnect_gauss_hbrdCut", "dist_spat_l2_mod_bgAndBrd_hbrdCut", "sim_spatConnect_gauss_mod_bgAndBrd_hbrdCut", "dist_html_sum_sim_spatConnect_gauss_mod_bgAndBrd_hbrdCut"]; // NOTE: Should I extract it in a settings obj/file? How? Either too many cryptic names, or too many ifthen switches
		// 1 - Prepping other data: for Getting primitives for membership tables and mapping _ids back on elements
		return Promise.all(["iframeStandAlone", "iframeAsPrims"].map(window.domGetters.getOtherGrPromise)).then(([jqIframeStandAlone, jqIfrAsPrims])=>{
			return __prepPrimitiveForGroupAnalysesAsync().then(primitives=>{
				primitives.ifrStAlone = jqIframeStandAlone.toArray();
				primitives.ifFrAsPrims = jqIfrAsPrims.toArray();
				return primitives;
			});
		}).then(primitives=>{
			// 1.2 - mapping _ids back on elements
			const _allPrimElDict = _primElArr2Dict(primitives.allPrimsElArr.concat(primitives.allPrimsNoCmpCntrlElArr, primitives.ifFrAsPrims));
			// 2 - get data to save
			const clustFitDat = [];
			const allGroupsArr = Object.keys(clustListArr).map(clustMethodName=>{
				// ensure clustListArr[clustMethodName] has objects and clustListArr[clustMethodName][0] has keys other than "_row"
				if(!clustListArr[clustMethodName] || clustListArr[clustMethodName].length === 0 || Object.keys(clustListArr[clustMethodName]).length < 2){
					return null; // nothing to process
				}
				const elArrArrByDatType = _mapIdsOnEls(_allPrimElDict, clustListArr[clustMethodName]);
				return Object.entries(elArrArrByDatType).map(([datType, elArrArr])=>{
					// NEW extra - only recording some data types/groups
					if(!dataTypesToRecord.includes(datType)){
						console.warn("[CLUSTER] SKIPPING data type", datType);
						return false;
					}
					// 3 - Find group Roots: Find the top HTML element for each group of elements
					const {roots, costBenefitLaddersArrOrig} = _findElGroupRoots(elArrArr);
					// 4 - Prep other groups (mixed and noNull) and enforce group ids
					const {grAsNodeColl, grMixed, idArr} = __prepClustGroups(elArrArr, roots, primitives.ifrStAlone);
					// 5 - record costBenefitLaddersArrOrig
					clustFitDat.push(... costBenefitLaddersArrOrig.map((ladderArr, i)=>{
						return {
							name: ["costBenefit", clustMethodName, datType, idArr[i]].join("_"),
							type: "txt",
							dat: window.__objArr2TabTable(ladderArr.map((ladder, i)=>{
								// remove "el" from ladders - no need to save nodes
								const trimLadder = ladder.map(fitObj=>{
									return Object.assign(fitObj, {el: fitObj.el.tagName.toLowerCase(), elId: fitObj.el._id, ladderI: i});
								});
								return trimLadder;
								// return window.__objArr2TabTable(trimLadder);
							}).flat()) //.reduce((a, x)=>a.concat(x))
						};
					}));
					// 6 - return
					const groups = {};
					// groups[clustMethodName + "_" + datType + "_grAsNodeColl"] = grAsNodeColl; // Also disabling this one -- way too many configurations to compare in the end
					// groups[clustMethodName + "_" + datType + "_grAsRoots"] = grAsRoots; // We disable this to reduce the amount of data to save/look through
					groups[clustMethodName + "_" + datType + "_grMixed"] = grMixed;
					return groups;
				});
			}).filter(x=>x).flat(); // filtering out empty cases
			// 7 - Get data/debug screenshots
			const allGroups = Object.assign({}, ...allGroupsArr);
			const promises = Object.keys(allGroups).map(grName=>{
				return semanticGroup2DataAsync(allGroups[grName], {grName: grName, keepOverlays: true, membershipNeeded: true, screenshotNeeded: false, debugScreenShotNeeded: true, skipCmpPrims: false}, primitives);
			});
			return Promise.all(promises).then(semGrResObjArr=>{
				// 8 - transferring data into global objects
				const debugScreenshots = {};
				const membDat = {};
				semGrResObjArr.forEach(semResObj => {
					Object.assign(membDat, semResObj.membership);
					Object.assign(debugScreenshots, semResObj.debug);
				});
				const outDat = semGrResObjArr.reduce((a, semGrResObj)=>{
					return a.concat(semGrResObj.data);
				}, []); // flattening it all down to a single arr to save as a single file
				// 9 - Prep for saving and Return
				return {
					clustFitDat: clustFitDat,
					dataTables: [{name: "clustGroupProps", type: "txt", dat: window.__objArr2TabTable(outDat)}],
					membershipTables: __datObj2ArrForSaving(membDat, "txt", __membership2TabTable), // [{name:string, dat:str, type:str}]
					debugScreenshots: __datObj2ArrForSaving(debugScreenshots, "jpeg", window.__cnvs2DataUrl, {type: "image/jpeg", quality: "mid"}) // [{name:string, dat:base64}]	
				};
			});
		});
	}

	window.getPageVarData = getPageVarData;
	window.primitiveClusters2Data = primitiveClusters2Data;
	
})();

undefined;
