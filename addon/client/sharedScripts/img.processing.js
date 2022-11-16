/* eslint-env browser */

// Script (partially) borrowed from the EasyScreenshot addon by Mozilla

(function () {
//	const DRAWWINDOW_USE_WIDGET_LAYERS = 0x08; // it made no difference when used in canvas screenshotting
//	let rootScrollable = document.compatMode === "BackCompat" ? document.body : document.documentElement;
	const MAX_SCREENSHOT_LENGTH = Math.pow(2, 15);
	const MIN_ALPHA_TO_NOT_IGNORE_IT = 0.9; // if it's higher, just consider an element/color/bgColor as set; no need to consider what's underneath
	
	const IMG_COMPRESSION_QUALITY = {
		"low": 0.15,
		"mid": 0.4,
		"high": 0.92,
		"none": 1
	};
	
	const UNIQUE_COLORS = [
		["vivid_yellow", [255, 179, 0]],
		["strong_purple", [128, 62, 117]],
		["vivid_orange", [255, 104, 0]],
		["very_light_blue", [166, 189, 215]],
		["vivid_red", [193, 0, 32]],
		["grayish_yellow", [206, 162, 98]],
		["medium_gray", [129, 112, 102]],
		["vivid_green", [0, 125, 52]],
		["strong_purplish_pink", [246, 118, 142]],
		["strong_blue", [0, 83, 138]],
		["strong_yellowish_pink", [255, 122, 92]],
		["strong_violet", [83, 55, 122]],
		["vivid_orange_yellow", [255, 142, 0]],
		["strong_purplish_red", [179, 40, 81]],
		["vivid_greenish_yellow", [244, 200, 0]],
		["strong_reddish_brown", [127, 24, 13]],
		["vivid_yellowish_green", [147, 170, 0]],
		["deep_yellowish_brown", [89, 51, 21]],
		["vivid_reddish_orange", [241, 58, 19]],
		["dark_olive_green", [35, 44, 22]]
	];


	function getPageScreenshotSize(ifFullLength) {
		// Badly named F -- it's supposed to prep a sizeObj for a full-page screenshot
		console.assert(window.getScrlEl().scrollHeight < MAX_SCREENSHOT_LENGTH, "The webpage is way too long -- expect errors --> we shouldn't probably take this webpage; its full length is:", window.getScrlEl().scrollHeight, "While we only allow: ", MAX_SCREENSHOT_LENGTH);
		// const sizeObj = {
		// 	x: 0,
		// 	y: 0,
		// 	t: 0,
		// 	l: 0 //,
		// 	// z: window.devicePixelRatio
		// };
		const sizeObj = Object.assign({x: 0, y: 0, t: 0, l: 0}, window.getFullPageBBox());
		if (!ifFullLength) {
			sizeObj.height = window.innerHeight;
		}
		sizeObj.h = (sizeObj.h === undefined?sizeObj.height:sizeObj.h);
		sizeObj.w = (sizeObj.w === undefined?sizeObj.width:sizeObj.w);
		
		// if (ifFullLength) {
		// 	let zoomedSizeLimit = MAX_SCREENSHOT_LENGTH; // Math.floor(MAX_SCREENSHOT_LENGTH / window.devicePixelRatio);
		// 	sizeObj.w = Math.min(window.__getSaneDocScrollWidth(), zoomedSizeLimit);
		// 	// sizeObj.w = Math.min(window.getScrlEl().scrollWidth, zoomedSizeLimit);
		// 	sizeObj.h = Math.min(window.getScrlEl().scrollHeight, zoomedSizeLimit);
		// } else {
		// 	// sizeObj.w = window.getScrlEl().clientWidth;
		// 	// sizeObj.h = window.getScrlEl().clientHeight;
		// 	sizeObj.w = window.__getSaneDocScrollWidth();//window.innerWidth;
		// 	sizeObj.h = window.innerHeight;
		// }
		return sizeObj;
	}

	function getScreenshotDataUrl(ifFullLength){
		return __cnvs2DataUrl(window.page2Canvas(ifFullLength));
		// return window.page2Canvas(ifFullLength).toDataURL().replace(/^data:image\/png;base64,/, "");
	};
	
	function page2Canvas(ifFullLength = true){
		const bbox = getPageScreenshotSize(ifFullLength);
		return screenPart2Canvas(bbox);
	};
	
	function getRgbAtPoints(cnvs, pArr){ // pArr = [{x:int, y:int}]
		const ctx = cnvs.getContext("2d");
		// const imgDat = cnvs.getContext("2d").getImageData(0, 0, cnvs.width, cnvs.height).data;
		return pArr.map(({x, y})=>{
			// 0 - fool check
			if(!(x>=0 && x<cnvs.width && y>=0 && y<cnvs.height)){
				debugger;
			}
			console.assert(x>=0 && x<cnvs.width && y>=0 && y<cnvs.height, "getRgbAtPoints coordinate outside cnvs, XY:", x, y, "cnvsDims:", cnvs.width, cnvs.height);
			// // 1 - convert xy to a flat i index
			// const i = ((y-1) * cnvs.width + (x-1)) * 4; // I believe cnvs is filled left-right, then next line; Mult by 4 cause 4 bytes per pixel
			const res = _rgba2rgb(Array.from(ctx.getImageData(x, y, 1, 1).data));
			console.assert(res[3]!==0, "We've taken a pixel outside a canvas!", window.location.href);
			return res;
		});
	}
	
	function _avgRgbArr(pixNestedArr){
		// if pixNestedArr is empty, let it fall -- we need to know that
		const n = pixNestedArr.length;
		return pixNestedArr.reduce((a, pixel)=>a.map((val, i)=>val+pixel[i])).map(val=>val/n);
	}

	function screenPart2Canvas(position) {
		const p = position;
		("top" in p) || (p.top = p.t);
		("left" in p) || (p.left = p.l);
		("width" in p) || (p.width = p.w);
		("height" in p) || (p.height = p.h);

		// let z = window.devicePixelRatio;
		let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
		canvas.width = p.width; // * z;
		canvas.height = p.height; // * z;
		canvas.mozOpaque = true;

		let ctx = canvas.getContext("2d");
		// ctx.scale(z, z);
		window.scrollTo(0, 0);// to make sure top menus etc. are positioned properly == Also in case I scroll it down for some reason... <-- If it's set with a page script, we should adjust for window.scrollX/Y <-- though this should be reflected already in the bounding box...
		try {
			ctx.drawWindow(window, p.left, p.top, p.width, p.height, "#fff");
//			ctx.scale(0.5, 0.5);
		} catch (e) {
			throw e; // it's here only to assign a breakpoint during debug
			//			console.error(e);
		}
		return canvas;
	};
	
	// function url2canvasAsync(url){
	// 	return new Promise(function(resolve, reject) {
	// 		const img = new Image();
	// 		// NOTE: onerror may be a duplicate for the catch() after decode()
	// 		// img.onerror = (err)=>{
	// 		// 	console.warn("Couldn't load an image in url2canvasAsync, url: ", url);
	// 		// 	reject(err);
	// 		// };
	// 		img.decode().catch(err=>{
	// 			console.warn("Couldn't decode an image in url2canvasAsync, url: ", url);
	// 			reject(err);
	// 		}).then(()=>{
	// 			const z = window.devicePixelRatio;
	// 			const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
	// 			canvas.width = img.naturalWidth * z;
	// 			canvas.height = img.naturalHeight * z;
	// 			canvas.mozOpaque = true;
	// 			const ctx = canvas.getContext("2d");
	// 			ctx.scale(z, z);
	// 			ctx.drawImage(img, 0, 0);
	// 			resolve(canvas);
	// 			// render; return
	// 		}).catch(err=>{
	// 			console.error("ERROR Rendering an image in a canvas: ", err, "url: ", url);
	// 			reject(err);
	// 		});
	// 		img.src = url;
	// 	});
	// }
	
	function url2canvasAsync(url, config = {ensureNoPlaceholderImg: false}){
		// NOTE: Rejects should be handled upstream
		const pr = (!config.ensureNoPlaceholderImg)
			?Promise.resolve()
			:fetch(url).then(resp=>{
				// see if a server might still send an (placeholder) image with a 404 response
				if(!resp.ok){
					return Promise.reject(new Error("Img not loaded, status:" + resp.status + " URL: " + url));
				}
				return Promise.resolve();
			});
		const img = new Image();
		img.setAttribute("src", url);
		// img.src = url;
		return Promise.all([pr, window._imgDecodeOrTimeout(img)]).then(()=>{
			// const z = window.devicePixelRatio;
			const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
			canvas.width = img.naturalWidth; // * z;
			canvas.height = img.naturalHeight; // * z;
			canvas.mozOpaque = true;
			const ctx = canvas.getContext("2d");
			// ctx.scale(z, z);
			ctx.drawImage(img, 0, 0);
			return canvas;
		});
	}

	function getImgFSizes(canvas) {
		return new Promise((resolve, reject) => {
			canvas.toBlob((pngBlob) => {
				canvas.toBlob((jpgBlob) => {
					resolve({
						pngSize: pngBlob.size,
						jpgSize: jpgBlob.size
					});
				}, "image/jpeg", 0.7);
			}, "image/png");
		});
	};
	
	// window._getNonRepeatedBgImgSizeNoOp = function(el, cb){
	// 	// NOTE: we'll switch to this instead of Bg estimation below: too much reverse engineering (bg size, position, repeat, content, padding, etc) for the few fringe cases of non-repeated BG as full blown images (instead of "img" tag)
	// 	return cb(null);
	// };

	// window._getNonRepeatedBgImgSize = function (el, cb) {
	// 	const styles = window.getComputedStyle(el);
	// 	const rptOpts = ["no-repeat", "repeat-x", "repeat-y"];
	// 	if (styles["background-image"].toLowerCase().indexOf("url") !== -1 && rptOpts.includes(styles.backgroundRepeat)) {
	// 		// there is background AND background-repeat doesnt cover the whole element area
	// 		const img = new Image();
	// 		img.onerror = function (err) {
	// 			console.error("Couldn't load an image to check it's size");
	// 			cb(null);
	// 		};
	// 		img.onload = function (ev) {
	// 			var sizes = {};
	// 			switch (styles.backgroundRepeat) {
	// 				case "no-repeat":
	// 					sizes.width = img.width;
	// 					sizes.height = img.height;
	// 					break;
	// 				case "repeat-x":
	// 					sizes.height = img.height;
	// 					break;
	// 				case "repeat-y":
	// 					sizes.width = img.width;
	// 					break;
	// 				default:
	// 					console.error("It can't be - we've just checked background-repeat to be one of our switch-case options, styles.backgroundRepeat", styles.backgroundRepeat, "rptOpts: ", rptOpts);
	// 			}
	// 			cb(sizes);
	// 		};
	// 		const __bgi = styles["background-image"];
	// 		img.src = __bgi.substring(5, __bgi.length - 2);
	// 	} else {
	// 		// there is no background - just return as it is
	// 		cb(null);
	// 	}
	// };

	function _getOnlyBgImgSizesAsync (jqBackImg) {
		return Promise.all(jqBackImg.toArray().map(bgImgEl=>{
			return new Promise(function(resolve, reject) {
				const st = window.getComputedStyle(bgImgEl);
				const cssUrl = window._urlFromCssStr(st["background-image"]);
				const defRes = {el: bgImgEl, loaded: false, nativeWidth: 0, nativeHeight: 0};
				// special case of SVG -- it takes the size of container
				if(cssUrl.indexOf("data:image/svg") > -1){
					const b = bgImgEl.getBoundingClientRect();
					bgImgEl.__hasSvgBg = true; // can't really be used for control detection -- we don't know what the semantics of the image are -- maybe it's a logo, not a control
					console.log("[IMG] data:image/svg found in src when in _getOnlyBgImgSizesAsync --> returning container sizes, ", b, window.location.href);
					resolve(Object.assign(defRes, {loaded: true, nativeWidth: b.width, nativeHeight: b.height}));
				}else{
					// else wait for the image to load
					const img = new Image();
					img.onerror = function (err) {
						console.log("Error loading a BG image, ", img.currentSrc, "el:", bgImgEl.tagName+"."+bgImgEl.className);
						resolve(defRes);
					};
					img.onload = function (ev) {
						resolve(Object.assign(defRes, {loaded: true, nativeWidth: img.width, nativeHeight: img.height}));
					};
					if(!cssUrl){
						console.warn("Bad css url: ", st["background-image"]);
						resolve(defRes);
					}
					img.setAttribute("src", cssUrl);
					// img.src = cssUrl;	
				}
			});
		}));
	};
	
	function __calAvgRGBa(pix){
		var r, g, b, a;
		r = g = b = a = 0;
		for (var i = 0, n = pix.length; i < n; i += 4) {
			r += pix[i];
			g += pix[i + 1];
			b += pix[i + 2];
			a += pix[i + 3];
		}
		r = r / (pix.length / 4);
		g = g / (pix.length / 4);
		b = b / (pix.length / 4);
		a = a / (pix.length / 4);
		return [r, g, b, a];
	}

	function __calAvgRGB(pix, toRound = true) {
		var r, g, b;
		r = g = b = 0;
		for (var i = 0, n = pix.length; i < n; i += 4) {
			let alpha = pix[i + 3] / 255;
			r += pix[i] * alpha;
			g += pix[i + 1] * alpha;
			b += pix[i + 2] * alpha;
			// i+3 is alpha (the fourth element)
		}
		r = r / (pix.length / 4);
		g = g / (pix.length / 4);
		b = b / (pix.length / 4);
		return (toRound ? [r, g, b].map(Math.round) : [r, g, b]);
	};

	window.__calcSD = function (pixArr, toRound = true) {
		const avgRGB = window.__calAvgRGB(pixArr, false);
		var r, g, b, sd;
		sd = r = g = b = 0;
		for (var i = 0, n = pixArr.length; i < n; i += 4) {
			let alpha = pixArr[i + 3] / 255;
			r = pixArr[i] * alpha;
			g = pixArr[i + 1] * alpha;
			b = pixArr[i + 2] * alpha;
			sd += (Math.pow(r - avgRGB[0], 2) + Math.pow(g - avgRGB[1], 2) + Math.pow(b - avgRGB[2], 2)) / 3;
		}
		sd = Math.sqrt(sd / (pixArr.length / 4));
		return (toRound ? (Math.round(sd * 100) / 100) : sd);
	};
	
	function getCnvsDiff(cnvs1, cnvs2, toleranceThr = 2, settings = {quickDiffOnly: false}){
		const BG_INTENSITY_DIFF_CNVS = 0.1; // 10% luminosity of original pixels - so we can understand where the difference is, if it's minimal
		console.assert(cnvs1.width === cnvs2.width && cnvs1.height === cnvs2.height, "PAGE/Canvas dimensions are different, width:", cnvs1.width, "VS", cnvs2.width, " Height: ", cnvs1.height, "VS", cnvs2.height);
		const imgDat1 = cnvs1.getContext("2d").getImageData(0, 0, cnvs1.width, cnvs1.height);
		const imgDat2 = cnvs2.getContext("2d").getImageData(0, 0, cnvs2.width, cnvs2.height);
		const imgArr1 = imgDat1.data;
		const imgArr2 = imgDat2.data;
		// const _tmpImgDat = cnvs1.getContext("2d").getImageData(0, 0, cnvs1.width, cnvs1.height);
		const nBytes = Math.min(imgArr1.length, imgArr2.length); // Just in case sizes are different; choose smaller
		const diffImgDat = (imgArr1.length>imgArr2.length)?imgDat1:imgDat2; // A bit awkward, but reconstructing imageData using Uint8ClampedArray and new ImageData resulted in a crashed Tab, no console/exceptions/errors. 
		// const diff = new Uint8ClampedArray(Math.max(imgArr1.length, imgArr2.length)); 
		// diff.fill(255);// fill it with non-transparent white - so differences in size are obvious when seen
		// Look through each pixel and record a difference
		var canvasesAreSame = true;
		var accuDiff = (imgArr1.length - imgArr2.length) * 0.75 * 255; // 0.75 so we don't count alpha channel
		for (var i = 0, n = nBytes; i < n; i += 4) {
			const alpha1 = imgArr1[i + 3] / 255;
			const alpha2 = imgArr2[i + 3] / 255;
			const rDif = Math.abs(imgArr1[i] * alpha1 - imgArr2[i] * alpha2);
			const gDif = Math.abs(imgArr1[i+1] * alpha1 - imgArr2[i+1] * alpha2);
			const bDif = Math.abs(imgArr1[i+2] * alpha1 - imgArr2[i+2] * alpha2);
			const totDif = rDif + gDif + bDif;
			if(totDif > toleranceThr){
				canvasesAreSame = false;
				if(settings.quickDiffOnly){ // speedUp -- returning without checking the rest of pixels...
					return {canvasesAreSame: canvasesAreSame};
				}
				accuDiff += totDif;
				// DO nothing; keep the original pixels so we see them
				// diff[i] = imgArr1[i];
				// diff[i+1] = imgArr1[i+1];
				// diff[i+2] = imgArr1[i+2];
				// diff[i+3] = imgArr1[i+3];
				
			}else{
				// paint this pixel black -- no difference
				// diff.fill(0, i, i+3); // End index not included in 'fill', so +3 (isntead of +2)
				// let's make it almost transparent black
				// diff[i] = Math.round(imgArr1[i] * BG_INTENSITY_DIFF_CNVS);
				// diff[i+1] = Math.round(imgArr1[i+1] * BG_INTENSITY_DIFF_CNVS);
				// diff[i+2] = Math.round(imgArr1[i+2] *  BG_INTENSITY_DIFF_CNVS);
				// diff[i+3] = imgArr1[i+3];
				
				
				diffImgDat.data[i] = Math.round(diffImgDat.data[i] * BG_INTENSITY_DIFF_CNVS);
				diffImgDat.data[i+1] = Math.round(diffImgDat.data[i+1] * BG_INTENSITY_DIFF_CNVS);
				diffImgDat.data[i+2] = Math.round(diffImgDat.data[i+2] * BG_INTENSITY_DIFF_CNVS);
			}
		}

		// construct a new canvas from difference
		// const _outCnvsWidth = (imgArr1.length >= imgArr2.length)?cnvs1.width:cnvs2.width;
		// const imgDat = new ImageData(diff, _outCnvsWidth);
		const diffCnvs = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
		diffCnvs.width = diffImgDat.width;
		diffCnvs.height = diffImgDat.height;
		// diffCnvs.width = imgDat.width;
		// diffCnvs.height = imgDat.height;
		diffCnvs.mozOpaque = true;
		const diffCnvsCtx = diffCnvs.getContext("2d");
		// diffCnvsCtx.putImageData(imgDat, 0, 0);
		
		diffCnvsCtx.putImageData(diffImgDat, 0, 0);
		return {
			sizeDiff: Math.abs(imgArr1.length - imgArr2.length),
			wDiff: cnvs1.width - cnvs2.width,
			hDiff: cnvs1.height - cnvs2.height,
			canvasesAreSame: canvasesAreSame,
			diffCnvs: diffCnvs,
			accuDiff: accuDiff
		};
	}
	
	function imprintRectOnFlatArr(numFlatArr, arrRowWidth, rect, change = -1){
		// Trying to measure whiteSpace using a 2d array (representing the page, encoded as a 1d array) and 'imprinting' a rectangle on it; arrRowWidth is essentially screen width
		if(rect.width < 0.5 || rect.height < 0.5){
			console.warn("Rect to imprint too small (doing nothing) -- possible since we'd expect innerBBox, but check if happens too often");
		}else{
			const arrOfIndexes = __rect2flatIndNONIMG(arrRowWidth, rect, {nChannels: 1});
			arrOfIndexes.forEach(flatI => {
				if(flatI < numFlatArr.length){
					numFlatArr[flatI] =+ change;
				}else{
					console.warn("Trying to imprint a rect outside the supplied flatArr, numFlatArr.length", numFlatArr.length, "flatI", flatI, window.location.href);
				}
			});	
		}
		return numFlatArr;
	}
	
	function __cleanAndRoundBBoxes(bbox){
		const bCpy = window.__cpyBBox(bbox);
		console.assert(bbox.left >= 0 && bbox.top >= 0 && bbox.right <= window.__getSaneDocScrollWidth() && bbox.bottom <= window.getScrlEl().scrollHeight, "BBox is (partially) outside of the scrollingElement, bbox:", bbox, " scrollWidth/Height", window.__getSaneDocScrollWidth(), window.getScrlEl().scrollHeight);
		// console.assert(bbox.left >= 0 && bbox.top >= 0 && bbox.right <= window.getScrlEl().scrollWidth && bbox.bottom <= window.getScrlEl().scrollHeight, "BBox is (partially) outside of the scrollingElement, bbox:", bbox, " scrollWidth/Height", window.getScrlEl().scrollWidth, window.getScrlEl().scrollHeight);
		// expand slightly a bbox - if we can't do that, the assert above will fail, notifying us
		bCpy.top = bCpy.y = Math.floor(bCpy.top);
		bCpy.left = bCpy.x = Math.floor(bCpy.left);
		bCpy.bottom = Math.ceil(bCpy.bottom);
		bCpy.right = Math.ceil(bCpy.right);
		bCpy.height = bCpy.bottom - bCpy.top;
		bCpy.width = bCpy.right - bCpy.left;
		return bCpy;
	}
	
	function countFlexWhiteSpace(pageW, pageH, flexContainerBBox, outerBBoxes, innerBBoxes){
		// 1 - create a canvas <-- We'll rely on Canvas Api instead of pixel counting -- much faster
		const hCnvs = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
		hCnvs.width = pageW; // full page size -- so we dont' need to transform bboxes in 0-indexed rects
		hCnvs.height = pageH;
		const hCnvsCtx = hCnvs.getContext("2d", {alpha: true});
		// 2 - Make starting canvas transparent
		hCnvsCtx.clearRect(0, 0, hCnvs.width, hCnvs.height);
		// // 3 - Create working area
		// hCnvsCtx.fillStyle = "rgba(0, 0, 0, 1)";
		// hCnvsCtx.fillRect(flexContainerBBox.x, flexContainerBBox.y, flexContainerBBox.width, flexContainerBBox.height);
		// 4 - imprint outer bboxes
		hCnvsCtx.fillStyle = "rgba(255, 0, 0, 1)";
		outerBBoxes.forEach((outerBox, i) => hCnvsCtx.fillRect(outerBox.x, outerBox.y, outerBox.width, outerBox.height));
		// 5 - make internal bboxes transparent
		// hCnvsCtx.fillStyle = "rgba(0, 0, 0, 0)";
		innerBBoxes.forEach((innerBox, i) =>hCnvsCtx.clearRect(innerBox.x, innerBox.y, innerBox.width, innerBox.height));
		// 6 - clip the flexContainerBBox in a separate canvas
		const imgDat2Count = hCnvsCtx.getImageData(flexContainerBBox.x, flexContainerBBox.y, flexContainerBBox.width, flexContainerBBox.height);
		// 7 - Count white pixels -- not sure what is the fastest way, let's try Reduce first
		const whSp = imgDat2Count.data.reduce((accu, val)=>accu+val);
		return whSp / (255 * 2); // because we use Red and Alpha channels
	}
	
	function highlightRectsOnCnvs(cnvs, rectArr){
		// clean and round bboxes
		// const rectArr = _rectArr.map(__cleanAndRoundBBoxes);
		// 1 - get the original page as a screenshot
		// const pageScrnshotImgDat = cnvs.getContext("2d").getImageData(0, 0, cnvs.width, cnvs.height);
		// 2 - Create/return a canvas with highlights
		const hCnvs = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
		hCnvs.width = cnvs.width;
		hCnvs.height = cnvs.height;
		const hCnvsCtx = hCnvs.getContext("2d", {alpha: true});
		// 3 - Gray-out everything outside rectangles
		// 3.0 - Make starting canvas transparent
		hCnvsCtx.clearRect(0, 0, cnvs.width, cnvs.height);
		// 3.1 - Put semi-transparent overlay over the entire page
		hCnvsCtx.fillStyle = "rgba(65, 0, 0, 0.6)";
		hCnvsCtx.fillRect(0, 0, cnvs.width, cnvs.height);
		// 3.2 - Create fully transparent "holes" in the overlay
		hCnvsCtx.fillStyle = "rgba(255, 255, 255, 1)";
		hCnvsCtx.globalCompositeOperation = "destination-out";
		rectArr.forEach(b => {
			hCnvsCtx.fillRect(b.x, b.y, b.width, b.height);
		});
		// 3.2 - Outline bboxes with colored lines
		hCnvsCtx.globalCompositeOperation = "source-over";
		hCnvsCtx.lineWidth = 3; // I wonder what happens when bbox is less than 5 px wide/tall?..
		hCnvsCtx.setLineDash([7, 3]);
		rectArr.forEach((b, i) => {
			const color = UNIQUE_COLORS[i % UNIQUE_COLORS.length][1];
			// const tmpCl = "rgba(" + color.join(", ") + ", 1)";
			// console.log("color for a rectangle:", tmpCl, b.x, b.y, b.width, b.height);
			hCnvsCtx.strokeStyle = "rgba(" + color.join(", ") + ", 1)";
			
			hCnvsCtx.strokeRect(b.x, b.y, b.width, b.height);
		});
		// 4 - The original page underneath the context
		hCnvsCtx.globalCompositeOperation = "destination-over";
		hCnvsCtx.drawImage(cnvs, 0, 0);
		// hCnvsCtx.putImageData(pageScrnshotImgDat, 0, 0);
		return hCnvs;
	}
	
	function highlightRectsOnCnvs_OLD(cnvs, _rectArr){
		// NOTE: AVOID using -- too slow
		// clean and round bboxes
		const rectArr = _rectArr.map(__cleanAndRoundBBoxes);
		// var pageCnvsBefore = window.page2Canvas(true);
		var imgArrDat = cnvs.getContext("2d").getImageData(0, 0, cnvs.width, cnvs.height);
		// outside rect areas are grayish
		const ifTakeAlphaChannel = false;
		const fullColorAreaInd = new Set(rectArr.map(rect=>{
			// convert rect to flat indices
			return __rect2flatInd(cnvs.width, rect, ifTakeAlphaChannel);
		}).reduce((a, x)=>a.concat(x), []));
		// Gray out areas outside our rectangles
		imgArrDat.data = imgArrDat.data.map((val, i)=>{
			if(!ifTakeAlphaChannel && !((i+1)%4)){
				return val; // we don't touch the alpha channel
			}
			if(!fullColorAreaInd.has(i)){
				return val * 0.2; // modify the value
			}
			return val;
		});
		// each block outlined with a blue line?... Individual colors for rect borders?
		const borderPixelsIndArr = rectArr.map(rect=>{
			const topLine = (new Array(rect.width)).fill().map((el, i)=>{
				return {x: i+rect.left, y: rect.top};
			});
			const botLine = (new Array(rect.width)).fill().map((el, i)=>{
				return {x: i+rect.left, y: rect.bottom};
			});
			const leftLine = (new Array(rect.height)).fill().map((el, i)=>{
				return {x: rect.left, y: rect.top+i};
			});
			const rightLine = (new Array(rect.width)).fill().map((el, i)=>{
				return {x: rect.right, y: rect.top+i};
			});
			return topLine.concat(botLine, leftLine, rightLine);
		});
		borderPixelsIndArr.forEach((indArr, rectI)=>{
			const color = UNIQUE_COLORS[rectI % UNIQUE_COLORS.length];
			indArr.forEach(xy => {
				const imgI = __xy2flatI(cnvs.width, xy.x, xy.y);
				color[1].forEach((val, i)=>{
					imgArrDat.data[imgI+i] = val; // sets RGB
				});
			});
		});
		// Create/return a canvas with highlights
		const hCnvs = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
		hCnvs.width = cnvs.width;
		hCnvs.height = cnvs.height;
		hCnvs.mozOpaque = true;
		const hCnvsCtx = hCnvs.getContext("2d");
		hCnvsCtx.putImageData(imgArrDat, 0, 0);
		// hCnvsCtx.putImageData((new ImageData(imgArr, cnvs.width)), 0, 0);
		return hCnvs;
	}
	
	function __xy2flatI(cnvsRowWidth, x, y){
		// A utility F, converts XY coords in a flat index for canvases' data (Uint8ClampedArray)
		return (cnvsRowWidth * 4) * (y - 1) + (x - 1) * 4;
	}
	
	function __rect2flatIndNONIMG(arrRowWidth, rect, settings = {nChannels: 1}){
		// nChannels should be === 4 for Img Processing
		arrRowWidth = arrRowWidth * settings.nChannels; // because 4 channels, each using one byte
		// takes a rectangle and converts it in indexes that rectangle pixels would correspond to in a flat array
		// dealing with potentially fractional coordinates
		const rH = Math.round(rect.height);
		const rT = Math.round(rect.top);
		const rW = Math.round(rect.width);
		const rL = Math.round(rect.left);
		return (new Array(rH)).fill().map((el, i)=>i+rT).map(rowI=>{
			const startI = (rowI-1)*arrRowWidth + rL * settings.nChannels;
			return (new Array(rW * settings.nChannels)).fill().map((el, i)=>startI+i);
		}).reduce((a, x)=>a.concat(x)); // final step: flatten array
	}
	
	function __rect2flatInd(cnvsRowWidth, rect, ifTakeAlphaChannel = false){
		// F used to determine pixels that should be "highlighted" -- mainly used for diagnostics when recording canvases/images of some element/grouping computation
		return __rect2flatIndNONIMG(cnvsRowWidth, rect, {nChannels: 4}).filter((el, i)=>{
			// if we need alpha, keep all; otherwise filter out every 4th index
			if(ifTakeAlphaChannel){
				return true;
			}
			return (i+1) % 4;
		});
		
		// cnvsRowWidth = cnvsRowWidth * 4; // because 4 channels, each using one byte
		// // takes a rectangle and converts it in indexes that rectangle pixels would correspond to in a canvas
		// return (new Array(rect.height)).fill().map((el, i)=>i+rect.top).map(rowI=>{
		// 	const startI = (rowI-1)*cnvsRowWidth + rect.left * 4;
		// 	return (new Array(rect.width * 4)).fill().map((el, i)=>startI+i).filter((el, i)=>{
		// 		// if no need for alpha channel, filter out every 4th index
		// 		if(ifTakeAlphaChannel){
		// 			return true;
		// 		}
		// 		return (i+1) % 4;
		// 	});
		// }).reduce((a, x)=>a.concat(x)); // final step: flatten array
	}
	
	function _cssCol2RgbaArr(cssColStr, alpha2uint = false){
		console.assert(cssColStr.indexOf("rgb") > -1, "Computed color isn't in RGB(a)!", cssColStr, window.location.href);
		return cssColStr.replace(")", "").split("(")[1].split(",").map(x=>x.trim()).map(x=>parseFloat(x));
	}
	
	function __alpha2uint(cssRgba){
		if(cssRgba[3] !== undefined){
			console.assert(cssRgba[3] >= 0 && cssRgba[3] <= 1, "A css color doesn't have its alpha within [0,1] ==> debug; color :", cssRgba.join(","), window.location.href);
			cssRgba[3] *= 255; // not sure about rounding it -- we'll keep fractions for now
		}
		return cssRgba;
	}
	
	function __cnvs2DataUrl(cnvs, options = {type: "image/png", quality: "high"}){
		switch (options.type) {
			case "image/png":
				// return cnvs.toDataURL().replace(/^data:image\/png;base64,/, "");
				break;
			case "image/jpeg":
				console.assert(IMG_COMPRESSION_QUALITY[options.quality] !== undefined);
				const encoderOptions = IMG_COMPRESSION_QUALITY[options.quality];
				return cnvs.toDataURL(options.type, encoderOptions).replace(/^data:image\/jpeg;base64,/, "");
			default:
				console.error("UNKNOWN image format: ", options.type, "Choose either image/png or image/jpeg. Using image/png for now.", location.href);
		}
		return cnvs.toDataURL().replace(/^data:image\/png;base64,/, "");
	}
	
	function _rgba2rgb(rgbaArr){
		// ATTENTION: can't be used on CSS colors, only Canvas pixel values
		console.assert(rgbaArr.length === 3 || rgbaArr.length === 4, "rgbaArr supplied not for a single pixel?.. rgbaArr:", rgbaArr, window.location.href);
		if(rgbaArr[3] === undefined){
			return rgbaArr; // it's already only 3 channels
		}
		if((rgbaArr[3] < 1 && rgbaArr[3] !== 0) || rgbaArr[3] > 255){
			debugger;
			console.error("_rgba2rgb Only works for the Canvas Color values -- the Alpha channel must be Int and in [0, 255], but the current value is:", rgbaArr[3], "Debug. Ensure we don't use a CSS rgba color here.");
		}
		const alpha = (rgbaArr[3] / 255);
		return rgbaArr.slice(0, 3).map((val)=>{
			return val * alpha;
		});
	}
	
	// TODO: make it sync -- no need for async here
	function getBgColorAsync(el, st = null, bbox = null){
		// Gets an RGB value (array of 3 or 4) - the bgColor of a passed element; st/bbox speed up computation; BBox may be important for texts (if it should be smaller than the entire display:block element that contains the text)
		// 0 - init if not yet
		st = st || window.getComputedStyle(el);
		bbox = bbox || el.getBoundingClientRect();
		// 1 - get cmp col vals
		const bgCol = _cssCol2RgbaArr(st["background-color"]);
		const hasBgImg = st["background-image"] !== "none"; // so we can deal with linear gradients //st["background-image"].indexOf("url(") > -1;
		// 2 - if an element has a bgImg OR its bgColor is (partially) transparent
		if(hasBgImg || (bgCol[3] !== undefined && bgCol[3] < MIN_ALPHA_TO_NOT_IGNORE_IT)){
			// 3 - get a screenshot and extract color from it
			const hideChildren = true;
			const whiteBg = false;
			const jqOverlays = null; // // OPTIMIZE: remove it altogether from _el2canvasNoOverlaysAsync
			const bgCnvs = window._el2canvasNoOverlays(el, bbox, hideChildren, jqOverlays, whiteBg);
			try {
				var avgBgCol = window.__calAvgRGB(bgCnvs.getContext("2d").getImageData(0, 0, bgCnvs.width, bgCnvs.height).data);
			} catch (e) {
				// console.error(e, location.href);
				console.error("[ALTER] Element to set animation to none (or something similar) in pageMods.js?..:", window.__el2stringForDiagnostics(el), JSON.stringify(bbox));
				console.error(e.toString(), location.href);
				debugger;
			}
			return Promise.resolve(avgBgCol);			
			// return window._el2canvasNoOverlaysAsync(el, bbox, hideChildren, jqOverlays, whiteBg).then(cnvs=>{
			// 	const avgBgCol = window.__calAvgRGB(cnvs.getContext("2d").getImageData(0, 0, cnvs.width, cnvs.height).data);
			// 	return avgBgCol;
			// });
		}
		// 4 - BgCol set -- just return it
		return Promise.resolve(bgCol);
	}
	
	const getStoredFullPageCanvas = (()=>{
		// I expect we'll have to rely on the fullpage canvas quite often -- let's keep a reference to it and not recalc
		var canvas = null;
		return (ifForceRefresh = false)=>{
			if(ifForceRefresh){
				canvas = null;
			}
			if(canvas === null){
				canvas = window.page2Canvas(true);
			}
			return canvas;
		};
	})();
	
	function combineCssColorWithBgColor(rgba, rgbBg){
		// if rgba has a fractional alpha channel, add some of rgbBG color <-- what the user actually sees
		if(rgba.length < 4){
			return rgba; // no alpha channel to take care of
		}
		console.assert(rgba[3] >= 0 && rgba[3] <= 1, "rgba needs to be a CSS color, with an alpha channel in [0, 1]", rgba.join("."), window.location.href);
		console.assert(rgbBg[3] === undefined || rgbBg[3] === 255 || rgbBg[3] === 1, "A bg color to combine an foreground color with should either have no alpha or be non-transparent: ", rgbBg.join("."), window.location.href);
		if(rgba[3] < 1){
			rgba[0] = rgba[0] * rgba[3] + rgbBg[0] * (1 - rgba[3]);
			rgba[1] = rgba[1] * rgba[3] + rgbBg[1] * (1 - rgba[3]);
			rgba[2] = rgba[2] * rgba[3] + rgbBg[2] * (1 - rgba[3]);
		}
		return rgba.slice(0, 3);
	}
	
	window.__cnvs2DataUrl = __cnvs2DataUrl;
	window.getCnvsDiff = getCnvsDiff;
	window.page2Canvas = page2Canvas;
	window.screenPart2Canvas = screenPart2Canvas;
	window.getScreenshotDataUrl = getScreenshotDataUrl;
	window.getRgbAtPoints = getRgbAtPoints;
	window._cssCol2RgbaArr = _cssCol2RgbaArr;
	window._rgba2rgb = _rgba2rgb;
	window.__calAvgRGB = __calAvgRGB;
	window.__calAvgRGBa = __calAvgRGBa;
	window.highlightRectsOnCnvs = highlightRectsOnCnvs;
	window.getBgColorAsync = getBgColorAsync;
	window.imprintRectOnFlatArr = imprintRectOnFlatArr;
	window.getStoredFullPageCanvas = getStoredFullPageCanvas;
	window.getImgFSizes = getImgFSizes;
	window.url2canvasAsync = url2canvasAsync;
	window.combineCssColorWithBgColor = combineCssColorWithBgColor;
	window.__alpha2uint = __alpha2uint;
	
	window._avgRgbArr = _avgRgbArr;
	window._getOnlyBgImgSizesAsync = _getOnlyBgImgSizesAsync;
	
	window.countFlexWhiteSpace = countFlexWhiteSpace;
	
	window.MAX_SCREENSHOT_LENGTH = MAX_SCREENSHOT_LENGTH;
})();
