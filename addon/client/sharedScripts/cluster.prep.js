
function getDistBtwPrimitivesAsync(){
	// OPTIMIZE: Produce half matrices and clone across a diagonal instead of producing full matrices

	// MAYBE: A shared bbox coordinate reduces distance (items in a row are seen as a group?...)	
	
	// NOTE:  Prims in the same rendering context (display:absolute, etc.) have smaller distances to themselves, but larger to others. <== I think I'll only do this for overlays
	// NOTE: repeat for both "with" and "without" computed controls
	// NOTE: repeat for different distances
	// NOTE: repeat with/without overlays <-- Probably removing overlays is "cleaner" -- it's closer to what designers intended, though it's not what users see
	// 0 - Prepping all the data
	const prArr = ["allPrimitives", "allPrimitivesNoCmpCntrl", "borderMoreThn1Side", "bgColChange", "iframeAsPrims"].map(window.domGetters.getOtherGrPromise);
	prArr.push(window.domGetters.getSemanticGrPrms("overlays"));
	return Promise.all(prArr).then(([jqPrims, jqPrimsNoCmp, jqBrd, jqBg, jqIfrAsPrims, jqOverlays])=>{
		const overlElArr = jqOverlays.toArray();
		const bgElArr = jqBg.toArray();
		const brdElArr = jqBrd.toArray();
		const prims = {
			withCmpWithOverl: jqPrims.add(jqIfrAsPrims).toArray()
			// noCmpWithOverl: jqPrimsNoCmp.add(jqIfrAsPrims).toArray(),
			// withCmpNoOverl: jqPrims.add(jqIfrAsPrims).toArray().filter(el => !overlElArr.some(overEl=>overEl.contains(el))) //,
			// noCmpNoOverl: jqPrimsNoCmp.add(jqIfrAsPrims).toArray().filter(el => !overlElArr.some(overEl=>overEl.contains(el)))
		};
		// 1 - Extract data matrices
		return Object.keys(prims).map(k=>{
			const primElArr = prims[k];
			const {
				htmlDistMtxs,
				adjMtxs,
				spatDistMtxs,
				spatialConnectdnssMtxs,
				rawDat
			} = getDistBtwPrimitivesOneGroup(primElArr, bgElArr, brdElArr);
			// 2 - Convert objMtx to arrays for saving as tabTables
			// NOTE: 3 types of output: distance matrices, similarity matrices, modifier matrices (similarity -- higher val, higher sim)
			const _2strF = window.__objArr2TabTable;
			return [
				_resObjObj2resStr(htmlDistMtxs, _2strF, [k, "dist", "html"], "txt"),
				_resObjObj2resStr(spatDistMtxs, _2strF, [k, "dist", "spat"], "txt"),
				_resObjObj2resStr(spatialConnectdnssMtxs, _2strF, [k, "sim", "spatConnect"], "txt"),
				_resObjObj2resStr(adjMtxs, _2strF, [k, "mod"], "txt"),
				// _resObjObj2resStr(bgSimMtx, _2strF, [k, "mod", "bg"], "txt"),
				// _resObjObj2resStr(brdSimMtx, _2strF, [k, "mod", "brd"], "txt"),
				_resObjObj2resStr(rawDat, JSON.stringify, [k, "rawDat"], "json")
			].reduce((a, x)=>a.concat(x)); // flatten array
		}).reduce((a, x)=>a.concat(x)); // flatten array again
	});
}

function _resObjObj2resStr(resObj, transformF = x=>x, prefixNameParts = [], type = "txt"){
	// a dumb convenience function; Preserves the top-level structure of result objMtx, while prepping the 2nd level for saving as tabTables <-- just check where it's used; too long to explain in a comment
	
	return Object.keys(resObj).map(key=>{
		return {
			name: prefixNameParts.concat([key]).join("_"),
			type: type,
			dat: transformF(resObj2resArr(resObj[key]))
		};
	});
}

function getDistBtwPrimitivesOneGroup(primElArr, bgElArr, brdElArr){
	// NOTE: all outputs are objMtx, which is {elId: {elId: val, elId1: val...}, ...}
	// 1 - Estimate distance between primitive elements in HTML
	const origRawDistObj = _findRawDistInHtml(primElArr);
	const htmlDistMtxs = {
		// "max": _rawDist2Dist(origRawDistObj, "max"),
		// "min": _rawDist2Dist(origRawDistObj, "min"),
		"sum": _rawDist2Dist(origRawDistObj, "sum")
	};
	// 2 + 3- Get adjustment mtx (that can be used later in R) based on common Bg and enclosing borders
	const _bgAndBrdEls = [... new Set(brdElArr.concat(bgElArr))]; // some elements can have both brd and bg
	const adjMtxs = {
		// "bg": _getEnclosureTransofrmMtx(primElArr, bgElArr),
		// "brd": _getEnclosureTransofrmMtx(primElArr, brdElArr),
		"bgAndBrd": _getEnclosureTransofrmMtx(primElArr, _bgAndBrdEls)
	};
	// 4 - Get distance mtx based on distance between innerBBoxes; Return XY separately <-- we'll experiment in R with combining/weighting/penalizing them
	// NOTE: we'll skip getClientRects for inline/text elements, and just presume all primites are Rectangles 
	const rawSpatDistMtx = _getRawSpatialDistMtx(primElArr, "dist");
	const spatDistMtxs = {
		// "max": _transformRawSpatDist(rawSpatDistMtx, "max"),
		// "l1": _transformRawSpatDist(rawSpatDistMtx, "l1"),
		"l2": _transformRawSpatDist(rawSpatDistMtx, "l2") //,
		// "bin": _transformRawSpatDist(rawSpatDistMtx, "bin", 5)
	};
	// 5 - Also get the overlap as a measurement <-- Weigh overlap by the other coord (1 - difference) <-- Weigh by element size
	// TODO: Implement 'absolute' overlap <-- can be useful; Else save bboxes for R
	const rawSpatOverlapMtx = _getRawSpatialDistMtx(primElArr, "overlap"); // NOTE: contains similarity; Needs to be inversed
	// 5.1 - Combine overlap with distance
	const settObj = {binThr: 15, linThr: 45, sigma: 14, nDescrGauss: 45};
	const spatialConnectdnssMtxs = { // SIMILARITY, not distance <-- Invert
		"gauss": _mergeSpatOverlapAndDist(rawSpatDistMtx, rawSpatOverlapMtx, "gauss", settObj) //,
		// "bin": _mergeSpatOverlapAndDist(rawSpatDistMtx, rawSpatOverlapMtx, "bin", settObj),
		// "lin": _mergeSpatOverlapAndDist(rawSpatDistMtx, rawSpatOverlapMtx, "lin", settObj)
	};
	// 7 - Save raw data for R later on
	const rawDat = { // SAVE with JSON.stringify
		spatDist: rawSpatDistMtx,
		htmlDist: origRawDistObj,
		spatOverlapSim: rawSpatOverlapMtx
	};
	return {
		htmlDistMtxs: htmlDistMtxs,
		adjMtxs: adjMtxs,
		spatDistMtxs: spatDistMtxs,
		spatialConnectdnssMtxs: spatialConnectdnssMtxs,
		rawDat: rawDat
	};
}

function _getEnclosureTransofrmMtx(primElArr, bgOrBrdElArr){ //, ifPosBased = false <== I don't remember why I earlier made this an input, since I never actually used it ==> determine dynamically if it's about positions
	// NOTE: outputs similarity
	// primitives within an enclosing backgroundColor/Image or border element are counted as being 'closer'
	// 0 - Create an empty objMtx
	const outMtxObj = Object.fromEntries(primElArr.map(primEl=>{
		return [primEl._id, Object.fromEntries(primElArr.map(anotherPrimEl=>{
			return [anotherPrimEl._id, (primEl._id === anotherPrimEl._id)?"NA":0];
		}))];
	}));
	// 0.1 - If enclosures are based on bbox overlap instead of Node.contains; get BBoxes (so we compute them only once)
	// if(ifPosBased){
	// 	var primElArrBBox = primElArr.map(window._getAbsBoundingRectAdjForParentOverflow);
	// 	var bgOrBrdElArrBBox = bgOrBrdElArr.map(window._getAbsBoundingRectAdjForParentOverflow);
	// }
	var primElArrBBox;
	// 1 - Increase similarity of shared-bg/brd primitives
	bgOrBrdElArr.forEach((envelopEl, envelopElI) => {
		// 1.a - Try detecting inside primitives based on HTML nestedness
		var insideIds = primElArr.filter(primEl=>envelopEl.contains(primEl)).map(el=>el._id);
		// 1.b - If this envelopEl contains no primitives, fall-back on position-based detection -- it's quite unlikely 
		if(insideIds.length === 0){
			if(primElArrBBox === undefined){
				primElArrBBox = primElArr.map(window._getAbsBoundingRectAdjForParentOverflow);
			}
			const envelBBox = window._getAbsBoundingRectAdjForParentOverflow(envelopEl);
			insideIds = primElArr.filter((primEl, primElI)=>{
				const primBBox = primElArrBBox[primElI];
				// const envelBBox = bgOrBrdElArrBBox[envelopElI];
				if(envelBBox.height < primBBox.height/2 || envelBBox.width < primBBox.width / 2){
					// envelop is less than half the size of primitive -- it shouldn't be seen as "containing" a primitive
					return false;
				}
				const inToleranceThr = Math.min(primBBox.height/2, primBBox.width/2); // Should we increase it?...
				// FIXME: Check if the envelop is underneath a primitive
				return window._do2bboxesOverlap(primBBox, envelBBox, inToleranceThr);
			}).map(el=>el._id);	
		}
		// 1.c - mark all contained primitives as being closer
		insideIds.forEach(rowId => {
			insideIds.forEach(colId => {
				if(rowId === colId){
					return; // do nothing, same element
				}
				// else up their similarity by 1
				outMtxObj[rowId][colId]++;
			});
		});
	});
	// 2 - return
	return outMtxObj;
}

function __discretizeGaussDistFading(sigma = 5, n = 25){
	// we'll use the output for 'fading' (aka, weighting) a distance between bboxes
	const mean = 0;
	const prefix = 1 / (sigma * Math.sqrt(2*Math.PI));
	const div = 2 * sigma * sigma;
	const res = (new Array(n)).fill().map((x, i)=>i).map(x=>{
		return prefix * Math.exp(-((x - mean) ** 2) / div);
	});
	const maxVal = Math.max(...res);
	return res.map(x=>x/maxVal);
}

function _mergeSpatOverlapAndDist(origRawSpatDistMtx, origRawSpatOverlapMtx, fadingMethod = "gauss", settings = {binThr: 15, linThr: 45, sigma: 7, nDescrGauss: 45}){
	// Produces a measure of bbox "connectedness"
	console.assert(settings.linThr > 1, "settings.linThr needs to be > 1, currently: ", settings.linThr);
	// 0 - Choose a function
	var distF;
	switch (fadingMethod) {
		case "gauss": // gradual fading
			const discrGaussW = __discretizeGaussDistFading(settings.sigma, settings.nDescrGauss);
			distF = (dist)=>{
				if(dist < 0){
					return 1;
				}
				if(dist > settings.nDescrGauss - 1){
					return 0;
				}
				return discrGaussW[Math.round(dist)];
			};
			break;
		case "bin": // 1 if withing the thr distance
			distF = (dist)=>+(dist < settings.binThr);
			break;
		case "lin": // linear decrease from 1 to 0
			// const linW = (new Array(settings.lingThr)).fill().map((x, i)=>(settings.lingThr - i)/settings.lingThr);
			distF = (dist)=>{
				if(dist < 0){
					return 1;
				}
				if(dist > settings.linThr - 1){
					return 0;
				}
				return (settings.linThr - 1 - dist) / (settings.linThr - 1); //linW[Math.round(dist)];
			};
			break;
		default:
			throw new Error("Method not know: " + fadingMethod + " " + window.location.href);
	}
	// 1 - populate an output object <-- We could also use formEntries instead
	const resObjMtx = {};
	Object.keys(origRawSpatDistMtx).forEach(rowIdKey => {
		const distRow = origRawSpatDistMtx[rowIdKey];
		const overlapRow = origRawSpatOverlapMtx[rowIdKey];
		resObjMtx[rowIdKey] = {};
		Object.keys(distRow).forEach(colIdKey => {
			const distObj = distRow[colIdKey];
			const overlObj = overlapRow[colIdKey];
			resObjMtx[rowIdKey][colIdKey] = (colIdKey === rowIdKey)?"NA":(overlObj["x"] * distF(distObj["y"]) + overlObj["y"] * distF(distObj["x"])); // overlap x by the opposire coord distance // this is ultimately a measure of 'connecteness' so Summing makes the most sense (instead of choosing the largest)
			
			// __mergeOverlapAndDist(distObj, overlObj, "x", distF) + __mergeOverlapAndDist(distObj, overlObj, "y", distF); 
		});
	});
	// 2 - Return
	return _makeMtxSymm(resObjMtx, "max");
}

function _makeMtxSymm(mtxObj, method = "max"){
	// makes a mtxObj "symmetrical";
	var f;
	switch (method) {
		case "max":
			f = Math.max;
			break;
		default:
	}
	const outMtxObj = __cloneRawDistObj(mtxObj);
	Object.keys(outMtxObj).forEach(rowIdKey => {
		Object.keys(outMtxObj[rowIdKey]).forEach(colIdKey => {
			if(colIdKey === rowIdKey){
				return; // do nothing for the diagonal
			}
			outMtxObj[rowIdKey][colIdKey] = f(outMtxObj[rowIdKey][colIdKey], outMtxObj[colIdKey][rowIdKey]);
		});
	});
	return outMtxObj;
}

// function __mergeOverlapAndDist(dist, overlap, coord = "x", f){
// 	// to be used in _mergeSpatOverlapAndDist
// 	return overlap[coord] * f(dist[coord]);
// }

function resObj2resArr(rawSpatDistMtx){
	// converts our obj of obj in an arr of obj -- so we can transform it into a tabtable and save as text
	return Object.keys(rawSpatDistMtx).map(rowId=>{
		const aRow = rawSpatDistMtx[rowId];
		aRow["rowElId"] = rowId;
		return aRow;
	});
}

function _transformRawSpatDist(origRawSpatDistMtx, method = "max", thr = 5){
	var trF;
	const wrapperF = (x, y)=>{
		// x and y describe horizontal/vertical distances between 2 blocks
		// 0 - a step common for all -- zeroing negative distances
		x = Math.max(0, x);
		y = Math.max(0, y);
		return trF(x, y);
	};
	// 1 - Pick a method
	switch (method) {
		case "max":
			trF = Math.max;
			break;
		case "l2": // euclidean
			trF = Math.hypot; 
			break;
		case "l1": // city-block
			trF = (x, y)=>x+y;
			break;
		case "bin": // binarize: connected or not; Requires a threshold; 0 means small distance
			trF = (x, y)=>(x < thr && y < thr)?0:1;
			break;
		default:
			throw new Error("Unknown method for transforming between bbox distances: ", method);
	}
	// 2 - Clone the original distance object - so it's unchanged for other methods
	const rawSpatDistMtx = __cloneRawDistObj(origRawSpatDistMtx);
	// 3 - Process distances
	Object.keys(rawSpatDistMtx).forEach(rowKey => {
		const aRow = rawSpatDistMtx[rowKey];
		Object.keys(aRow).forEach(colKey => {
			if(colKey === rowKey){
				 // do nothing
				 console.assert(aRow[colKey] === "NA", "Diagonal distances are supposed to be NA, but they aren't:", aRow[colKey], colKey, rowKey, window.location.href);
				 return;
			}
			const xy = aRow[colKey];
			aRow[colKey] = wrapperF(xy.x, xy.y);
		});
	});
	// 4 - Return
	return rawSpatDistMtx;
}

function _getRawSpatialDistMtx(primElArr, method = "dist"){
	// NOTE: method === "overlap" requires a full matrix produced -- it's not symmetrical across the diagonal, since overlap produces normalized overlaps, not absolute
	// 0 - setup
	const f = (method === "dist")?__2bboxToDist:__2bboxToOverlap;
	console.assert(method === "dist" || method === "overlap", "Only 'dist' and 'overlap' methods are supported", method, window.location.href);
	// 1 - Map primElArr onto a bbox array
	const primElBBoxArrObj = Object.fromEntries(primElArr.map(primEl=>{
		return [primEl._id, primEl.getBoundingClientRect()]; // here using the native bbox -- primitives have got to be visible -- we ensure that beforehand
	}));
	const ids = Object.keys(primElBBoxArrObj);
	// 2 - Return min dist between external edges
	return Object.fromEntries(ids.map(id=>{
		const currBBox = primElBBoxArrObj[id];
		return [id, Object.fromEntries(ids.map(anotherId=>{
			if(anotherId === id){
				return [anotherId, "NA"];
			}
			const anotherBBox = primElBBoxArrObj[anotherId];
			// const distY = __2bboxToDist(currBBox, anotherBBox, "y");
			// const distX = __2bboxToDist(currBBox, anotherBBox, "x");
			const distY = f(currBBox, anotherBBox, "y");
			const distX = f(currBBox, anotherBBox, "x");
			return [anotherId, {x: distX, y: distY}];
		}))];
	}));
	// returns {_id: {_anotherId: {x: intDist, y: intDist}, ...}, ...}
}

function __2bboxToOverlap(targetBbox, otherBbox, coord = "x"){
	console.assert(coord === "x" || coord === "y", "Only x and y are acceptable as a 'coord' parameter");
	const top = (coord === "y")?"top":"left";
	const bot = (coord === "y")?"bottom":"right";
	// 1 - find the lower "top" and higher "bottom"
	const lTop = Math.max(targetBbox[top], otherBbox[top]);
	const hBot = Math.min(targetBbox[bot], otherBbox[bot]);
	// 2 - The diff is the overlap
	const diff = hBot - lTop;
	// 3 - Make it relative to the targetBBox size
	if(diff <= 0){
		return 0;
	}
	return diff/(targetBbox[bot] - targetBbox[top]);
}

function __2bboxToDist(bbox1, bbox2, coord = "x"){
	// finds a one-coord distance between bboxes -- if bboxes overlap, distance is 0
	console.assert(coord === "x" || coord === "y", "Only x and y are acceptable as a 'coord' parameter");
	const top = (coord === "y")?"top":"left";
	const bot = (coord === "y")?"bottom":"right";
	// 1 - find a "lower" bbox
	const lowBbox = (bbox1[top] < bbox2[top])?bbox2:bbox1;
	const hiBbox = (bbox1[top] < bbox2[top])?bbox1:bbox2;
	// 2 - Return the dist from the 'top' of lower bbox to the 'bottom' of higher bbox <-- if it's negative, we have an overlap
	const dist = lowBbox[top] - hiBbox[bot];
	return Math.max(dist, 0);
}

function __cloneRawDistObj(origRawDistObj){
	const rawDistObj = Object.assign({}, origRawDistObj);
	Object.keys(rawDistObj).forEach(key => {
		rawDistObj[key] = Object.assign({}, rawDistObj[key]);
	});
	return rawDistObj;
}

function _rawDist2Dist(origRawDistObj, method = "max"){
	// methods: max (max distance to a shared ancestor); sum (combined distance; distance btwn 2 els via a shared ancestor); min (min dist to the shared ancestor)
	var f;
	switch (method) {
		case "max":
			f = Math.max;
			break;
		case "min":
			f = Math.min;
			break;
		case "sum":
			f = (a, b) => a+b;
			break;
		default:
			throw new Error("Unknown method for distance transformation: " + method);
	}
	// 1 - Clone a rawDistObj, down to binary arrays <-- they can/should be replaced
	const rawDistObj = __cloneRawDistObj(origRawDistObj);
	// const rawDistObj = Object.assign({}, origRawDistObj);
	// Object.keys(rawDistObj).forEach(key => {
	// 	rawDistObj[key] = Object.assign({}, rawDistObj[key]);
	// });
	// 2 - aggregate distances
	var _checkDone = false;
	Object.keys(rawDistObj).forEach(rowIdKey => {
		const aRowObj = rawDistObj[rowIdKey];
		Object.keys(aRowObj).forEach(colIdKeys =>{
			if(aRowObj[colIdKeys] === "NA"){
				return; // no action for the diagonal items
			}
			if(!_checkDone){
				console.assert(aRowObj[colIdKeys].length === 2, "The origRawDistObj is supposed to contain pairs of distances, but isn't --> debug", aRowObj[colIdKeys], window.location.href);
				_checkDone = true;
			}
			aRowObj[colIdKeys] = f(... aRowObj[colIdKeys]);
		});
	});
	// 3 - return
	return rawDistObj;
}

function _findRawDistInHtml(primElArr){
	// Returns an object of objects, which are rows; 2nd-level Objects' values are pairs [dist1, dist2] to a shared ancestor btw 2 elements
	return Object.fromEntries(primElArr.map(primEl=>{
		return [primEl._id, Object.fromEntries(primElArr.map(anotherPrimEl => {
			// 0 - if same element, return "NA"
			if(primEl.isSameNode(anotherPrimEl)){
				return [anotherPrimEl._id, "NA"];
			}
			// 1 - Count steps till a common ancestor
			var potentialSharedAncestor = primEl;
			var steps2Anc = 0;
			while(potentialSharedAncestor !== null && !potentialSharedAncestor.contains(anotherPrimEl)){
				potentialSharedAncestor = potentialSharedAncestor.parentElement;
				steps2Anc++;
			}
			// 1.1 - Fool/Error checks
			console.assert(potentialSharedAncestor !== null, "We have 2 primitives without a shared ancestor. How exactly is it possible? ", window.__el2stringForDiagnostics(primEl), window.__el2stringForDiagnostics(anotherPrimEl));
			// console.assert(steps2Anc > 0, "We have nested primiitives <-- Didn't we ensure it can't be? Debug.", window.__el2stringForDiagnostics(primEl), window.__el2stringForDiagnostics(anotherPrimEl)); <== No, this is possible -- bg Images can contain other things
			// 2 - Count steps from 'anotherPrimEl'
			var steps2AncFromAnotherPrim = 0;
			var prntPointer = anotherPrimEl;
			while(prntPointer !== potentialSharedAncestor && prntPointer !== null){
				prntPointer = prntPointer.parentElement;
				steps2AncFromAnotherPrim++;
			}
			// 2.1 - Fool/Error checks
			console.assert(prntPointer !== null, "We have 2 primitives without a shared ancestor. But we've just checked that the 1st 'contains' the 2nd -- unless it went all the way up to <html> ", window.__el2stringForDiagnostics(primEl), window.__el2stringForDiagnostics(anotherPrimEl));
			// 3 - return
			return [anotherPrimEl._id, [steps2Anc, steps2AncFromAnotherPrim]];
		}))];
	}));
}

window.getDistBtwPrimitivesAsync = getDistBtwPrimitivesAsync;

undefined;
