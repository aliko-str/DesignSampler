main = function(inDat){
	require("jsonlite")
	require("dplyr")
	require("dynamicTreeCut")
	options(stringsAsFactors = F)
	inDatFolder = fromJSON(inDat)$dataFolder
	# 1 - For each groups of Primitives
	primGrNames = getPrimGrNames(inDatFolder)
	# 2 - Run clustering
	resL = lapply(primGrNames, cluster1PrimitiveType, mainDatFolder = inDatFolder)
	names(resL) = primGrNames
	# 3 - Save data on hd
	nouse = sapply(names(resL), function(primType){
		write.table(resL[[primType]], file.path(inDatFolder, paste0(primType, "_clustRes.txt")), append = F, quote = F, sep = "\t", row.names = T)
	})
	# TODO: try catch and error piping in a file
	# 3 - Convert a nested List to JSON; return
	# 4 - Flatten our nested Result List; Leafs are Lists of Lists of elIds ==> arr of arr of ids in JS
	toJSON(resL, dataframe = "rows")
}

getPrimGrNames = function(inDatFolder){
	namesL = list.files(inDatFolder, pattern = ".txt") %>%
		strsplit("_", fixed = T) %>%
		sapply(function(x)x[1])
	namesV = unique(namesL)
	return(namesV)
}

sumMtxWithAllRecurs = function(extMtxName, extMtx, mtxLL, lvlRec, wL){
	mtxL = mtxLL[[lvlRec]]
	# apply weights to mtxL
	mtxL = lapply(mtxL, function(mtx) mtx * wL[[lvlRec]])
	# combine mtx and mtxL - if mtx is present (i.e., if it's not the 1st level)
	if(!is.na(extMtxName)){
		# extMtx = mtxLL[[lvlRec-1]][[extMtxName]]
		mtxL = lapply(mtxL, function(mtx) mtx + extMtx[rownames(mtx), colnames(mtx)])
		names(mtxL) = paste0(extMtxName, "_", names(mtxL))
	}
	# launch recursion - if mtxLL+1 isn't na
	if(lvlRec+1 <= length(mtxLL)){
		# # record changed in mtxLL -- because we pass a name/index, and not a modified matrix
		# mtxLL[lvlRec] = mtxL
		mtxL = Reduce(c, lapply(names(mtxL), function(anotherName) sumMtxWithAllRecurs(anotherName, mtxL[[anotherName]], mtxLL, (lvlRec+1), wL)))
	}
	# return
	mtxL
}

sumAllWithAll = function(mtxLL, w = c()){
	stopifnot(length(w) == length(mtxLL))
	# combine
	outRes = sumMtxWithAllRecurs(NA, NA, mtxLL, 1, w)
	# normalize back in [0,1]
	nrmDiv = sum(w)
	lapply(outRes, function(mtx)mtx/nrmDiv)
}

# tmpTstCorr = function(allDL1){
	# require("corrplot")
	# aFr = na.omit(as.data.frame(lapply(allDL1, c)))
	# corUtil = source("/Users/Aleksii/Documents/Dropbox/R/util/corUtil.r")$value
	# res = corUtil$strongCorr(aFr, cutOffThr = 0.9)
	# res
	# # m = cor(aFr)
	# # corrplot(m, method = "number")
# }

cluster1PrimitiveType = function(primType, mainDatFolder, doSttcCut = F){
	allF = list.files(mainDatFolder, pattern = primType)
	# 1 - Read all data
	distHtmlL = readDatSubGr(allF, "_dist_html_", mainDatFolder, primType)
	distSpatL = readDatSubGr(allF, "_dist_spat_", mainDatFolder, primType)
	simL = readDatSubGr(allF, "_sim_spatConnect_", mainDatFolder, primType)
	modL = readDatSubGr(allF, "_mod_", mainDatFolder, primType)
	# 1.1 - Normalize to (0,1)
	distNHtmlL = lapply(distHtmlL, scaleMtx)
	distNSpatL = lapply(distSpatL, scaleMtx)
	simNL = lapply(simL, scaleMtx)
	# 1.2 - Convert sim to dist
	distNConnL = lapply(simNL, function(mtx) 1-mtx)
	# 2 - Combine different types of data
	# 2.1 - Prep modifiers -- so we can simply divide element wise
	modL = lapply(modL, function(mtx)mtx+1)
	# 2.2 - Put all data in a list
	origDatL = c(distNHtmlL, distNSpatL, distNConnL)
	# 2.3 - Combine each with each <-- do we use weights?...
	# sumAllL = sumAllWithAll(list(distNHtmlL, distNSpatL, distNConnL), c(1,1,1))
	sumHtmlSpatL = sumAllWithAll(list(distNHtmlL, distNSpatL), c(1,0.5))
	sumHtmlConnL = sumAllWithAll(list(distNHtmlL, distNConnL), c(1,0.5))
	# allDL = c(origDatL, sumAllL, sumHtmlSpatL, sumHtmlConnL)
	allDL = c(origDatL, sumHtmlSpatL, sumHtmlConnL)
	# 2.4 - Apply modifiers
	modDatL = Reduce(c, lapply(names(allDL), function(distMName){
		distM = allDL[[distMName]]
		# Being in a shared bg/brd element should reduce distance --> divide distances by a mod mtx
		outM = lapply(modL, function(modM){
			distM / modM[rownames(distM), colnames(distM)]
		})
		names(outM) = paste0(distMName, "_", names(outM))
		outM
	}))
	# 3 - Cluster with different methods/distances - Produce dendograms
	# NOTE: We only use 1 hclust linkage method for now -- we don't have a way to choose until we a criterion, like visual inspection of clusters or matching against user-selected areas
	# 3.1 - Convert to dist obj
	distObjL = lapply(c(allDL, modDatL), as.dist, diag = T)
	# distObjL = lapply(c(allDL, modDatL), function(mtx){
		# diag(mtx)=0
		# mtx
	# })
	# 3.2 - HClust
	dendDL = lapply(distObjL, function(d){
		hclust(d, method = "ward.D2")
	})
	# 4 - Assign Cluster labels - Using static/dynamic/hybrid tree cutting
	# tryCatch({
		# labels2Enforce = dendDL[[1]]$labels
	# }, error = function(e) stop(paste(e, primType, mainDatFolder, "distObjL length:", length(distObjL), "names:", paste(names(distObjL), collapse=", "))))
	
	# 4.1 - check if there is any data -- otherwise we don't have labels
	if(!length(dendDL)){
		return(list());
	}
	labels2Enforce = dendDL[[1]]$labels
	labDL = lapply(names(dendDL), function(datName){
		dendObj = dendDL[[datName]]
		distM = as.matrix(distObjL[[datName]])
		clustIds = cutreeHybrid(dendro = dendObj, distM = distM, cutHeight = max(dendObj$height)*0.95, minClusterSize = 2, pamStage = F, verbose = 0)$labels
		names(clustIds) = dendObj$labels
		clustIds[labels2Enforce]
	})
	names(labDL) = names(dendDL)
	hybridResFr = as.data.frame(labDL)
	colnames(hybridResFr) = paste0(colnames(hybridResFr), "_hbrdCut")
	# 4.2 - Static-height cutting
	if(!doSttcCut){
		return(hybridResFr);
	}
	nItems = length(labels2Enforce)
	stLabDL = lapply(dendDL, function(d){
		d$height = round(d$height, 6)
		h = max(d$height)*(1-1/log(nItems, base = exp(1.4))) # more items means higher thresholds, fewer clusters
		cutree(d, h=h)[labels2Enforce]
	})
	staticResFr = as.data.frame(stLabDL)
	colnames(staticResFr) = paste0(colnames(staticResFr), "_sttcCut")
	# 5 - Return labels
	cbind(hybridResFr, staticResFr)
}
# TODO: check how much resulting mtxs correlate -- to find out if some combinations are redundant

scaleMtx = function(mtx){
	maxVal = max(mtx, na.rm = T)
	mtx/maxVal
}

readDatSubGr = function(filesL, pattern, mainDatFolder, primType = "withCmpWithOverl"){
	# getting a data list
	fNames = grep(pattern, filesL, value = T, fixed = T)
	datL = lapply(fNames, function(f){
		x = read.table(file.path(mainDatFolder, f), header = T, sep = "\t", quote = "", row.names = "rowElId") %>% as.matrix();
		x[colnames(x),]
	})	
	names(datL) = gsub(".txt", "", gsub(paste0(primType, "_"), "", fNames, fixed = T), fixed = T)
	# filter out data.frames with < 3 rows -- we can't do clustering on these
	datL = Filter(function(mtx){
		return(!is.null(mtx) && nrow(mtx) > 2)
	}, datL)
	datL
	# # data type - e.g., 'html' and 'spat' for dist
	# datTypes = names(datL) %>%
		# strsplit(split = "_", fixed = T) %>%
		# `[[`(2)
	# datTypes = unique(unlist(datTypes))
	# lapply(datTypes, function(type){
		# datL[grep(type, names(datL), value = T, fixed = T)]
	# })
}

suppressPackageStartupMessages(suppressWarnings(main(Sys.getenv("inDat"))));
