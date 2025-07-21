import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MAsset, TAsset, TUpdatePropertyOptions } from "./../models/asset.model";
import { TKeyValuePair } from "./../local";

export default function useAssetRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("assets");
  const configurationCollection = atlas.getDb().collection("configuration");
  const lossCollection = atlas.getDb().collection("losses");
  const maintenanceCollection = atlas.getDb().collection("maintenances");
  const stockCollection = atlas.getDb().collection("stocks");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { deletedAt: 1 } }, { key: { type: 1, deletedAt: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ name: "text", stockNumber: "text", description: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ type: 1, name: 1, deletedAt: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createAsset(value: TAsset, session?: ClientSession) {
    const asset = new MAsset(value);

    try {
      const existingName = await collection.findOne({ type: value.type, name: value.name, deletedAt: null });
      if (existingName) {
        throw new BadRequestError("Item name already exists.");
      }

      const res = await collection.insertOne(asset, { session });
      return res.insertedId.toString();
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Asset name already exists.");
      }

      throw error;
    }
  }

  async function getAssets({ page = 1, limit = 10, sort = {}, search = "", type = "", role = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      createdAt: number;
      stockNumber: number;
      name: number;
      description: number;
      article: number;
      cost: number;
      initialQty?: number;
      quantity?: number;
      unitOfMeasurement: number;
      goodCondition?: number;
      reissued?: number;
      transferred?: number;
      returned?: number;
      forDisposal?: number;
      lost?: number;
      stolen?: number;
      damaged?: number;
      destroyed?: number;
    };

    const project: TProject = {
      createdAt: 1,
      stockNumber: 1,
      name: 1,
      description: 1,
      article: 1,
      cost: 1,
      unitOfMeasurement: 1,
    };

    if (["admin", "admin-head"].includes(role)) {
      project.quantity = 1;

      if (["SEP", "PPE"].includes(type)) {
        project.initialQty = 1;
        project.goodCondition = 1;
        project.reissued = 1;
        project.transferred = 1;
        project.returned = 1;
        project.forDisposal = 1;
        project.lost = 1;
        project.stolen = 1;
        project.damaged = 1;
        project.destroyed = 1;
      }
    }

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] } } },
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: { assetId: "$assetId", itemNo: "$itemNo" },
                latestCondition: { $first: "$condition" },
              },
            },
            {
              $group: {
                _id: "$_id.assetId",
                goodCondition: { $sum: { $cond: [{ $eq: ["$latestCondition", "good-condition"] }, 1, 0] } },
                reissued: { $sum: { $cond: [{ $eq: ["$latestCondition", "reissued"] }, 1, 0] } },
                transferred: { $sum: { $cond: [{ $eq: ["$latestCondition", "transferred"] }, 1, 0] } },
                returned: { $sum: { $cond: [{ $eq: ["$latestCondition", "returned"] }, 1, 0] } },
                forDisposal: { $sum: { $cond: [{ $eq: ["$latestCondition", "for-disposal"] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$latestCondition", "lost"] }, 1, 0] } },
                stolen: { $sum: { $cond: [{ $eq: ["$latestCondition", "stolen"] }, 1, 0] } },
                damaged: { $sum: { $cond: [{ $eq: ["$latestCondition", "damaged"] }, 1, 0] } },
                destroyed: { $sum: { $cond: [{ $eq: ["$latestCondition", "destroyed"] }, 1, 0] } },
              },
            },
          ],
          as: "stockConditions",
        },
      },
      {
        $addFields: {
          goodCondition: {
            $subtract: [
              "$quantity",
              {
                $add: [{ $ifNull: ["$stockSummary.returnedCount", 0] }, { $ifNull: [{ $arrayElemAt: ["$stockConditions.transferred", 0] }, 0] }],
              },
            ],
          },
          reissued: { $arrayElemAt: ["$stockConditions.reissued", 0] },
          transferred: { $arrayElemAt: ["$stockConditions.transferred", 0] },
          returned: { $arrayElemAt: ["$stockConditions.returned", 0] },
          forDisposal: { $arrayElemAt: ["$stockConditions.forDisposal", 0] },
          lost: { $arrayElemAt: ["$stockConditions.lost", 0] },
          stolen: { $arrayElemAt: ["$stockConditions.stolen", 0] },
          damaged: { $arrayElemAt: ["$stockConditions.damaged", 0] },
          destroyed: { $arrayElemAt: ["$stockConditions.destroyed", 0] },
        },
      },
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return paginate(items, page, limit, length);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForTransfer({ page = 1, limit = 10, sort = {}, search = "", type = "", role = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      stockNumber: number;
      name: number;
      description: number;
      goodCondition?: number;
      reissued?: number;
      returned?: number;
    };

    const project: TProject = {
      stockNumber: 1,
      name: 1,
      description: 1,
    };

    if (["admin", "admin-head"].includes(role)) {
      project.goodCondition = 1;
      project.reissued = 1;
      project.returned = 1;
    }

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
            { $group: { _id: { itemNo: "$itemNo", assetId: "$assetId" }, totalOuts: { $sum: "$outs" } } },
          ],
          as: "goodCondition",
        },
      },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$assetId", "$$assetId"] },
                condition: { $in: ["reissued", "transferred", "returned", "for-disposal", "lost", "stolen", "damaged", "destroyed"] },
              },
            },
            {
              $group: {
                _id: { assetId: "$assetId", condition: "$condition", itemNo: "$itemNo" },
                totalOuts: { $sum: "$outs" },
                totalIns: { $sum: "$ins" },
              },
            },
            {
              $group: {
                _id: "$_id.assetId",
                reissuedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "reissued"] }, "$totalOuts", 0] } },
                transferredTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "transferred"] }, "$totalOuts", 0] } },
                returnedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "returned"] }, "$totalIns", 0] } },
                forDisposalTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "for-disposal"] }, "$totalOuts", 0] } },
                lostTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "lost"] }, "$totalOuts", 0] } },
                stolenTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "stolen"] }, "$totalOuts", 0] } },
                damagedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "damaged"] }, "$totalOuts", 0] } },
                destroyedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "destroyed"] }, "$totalOuts", 0] } },
              },
            },
            {
              $addFields: {
                finalTotalOuts: {
                  $max: [
                    0,
                    {
                      $subtract: [
                        "$reissuedTotal",
                        { $add: ["$returnedTotal", "$forDisposalTotal", "$lostTotal", "$stolenTotal", "$damagedTotal", "$destroyedTotal"] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "reissued",
        },
      },
      { $unwind: { path: "$reissued", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
            { $group: { _id: "$itemNo", totalIns: { $sum: "$ins" } } },
          ],
          as: "returned",
        },
      },
      { $unwind: { path: "$returned", preserveNullAndEmptyArrays: true } },
      {
        $set: {
          goodCondition: { $subtract: ["$quantity", { $size: "$goodCondition" }] },
          reissued: "$reissued.finalTotalOuts",
          returned: "$returned.totalIns",
        },
      },
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return paginate(items, page, limit, length);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForReturn({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    type = "",
    role = "",
    userId = "",
  }: {
    page: number;
    limit: number;
    sort: {};
    search: string;
    type: string;
    role: string;
    userId: string | ObjectId;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    type TProject = {
      stockNumber: number;
      name: number;
      description: number;
      reissued?: number;
    };

    const project: TProject = {
      stockNumber: 1,
      name: 1,
      description: 1,
    };

    if (["admin", "admin-head"].includes(role)) {
      project.reissued = 1;
    }

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id", reference: "$reference" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$assetId", "$$assetId"] },
                condition: { $in: ["reissued", "transferred", "returned", "for-disposal", "lost", "stolen", "damaged", "destroyed"] },
              },
            },
            {
              $group: {
                _id: { assetId: "$assetId", condition: "$condition", reference: "$reference" },
                totalOuts: { $sum: "$outs" },
                totalIns: { $sum: "$ins" },
              },
            },
            {
              $group: {
                _id: "$_id.assetId",
                reference: { $first: { $getField: { field: "reference", input: "$_id" } } },
                reissuedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "reissued"] }, "$totalOuts", 0] } },
                transferredTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "transferred"] }, "$totalOuts", 0] } },
                returnedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "returned"] }, "$totalIns", 0] } },
                forDisposalTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "for-disposal"] }, "$totalOuts", 0] } },
                lostTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "lost"] }, "$totalOuts", 0] } },
                stolenTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "stolen"] }, "$totalOuts", 0] } },
                damagedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "damaged"] }, "$totalOuts", 0] } },
                destroyedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "destroyed"] }, "$totalOuts", 0] } },
              },
            },
            {
              $addFields: {
                finalTotalOuts: {
                  $max: [
                    0,
                    {
                      $subtract: [
                        "$reissuedTotal",
                        { $add: ["$returnedTotal", "$forDisposalTotal", "$lostTotal", "$stolenTotal", "$damagedTotal", "$destroyedTotal"] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "reissued",
        },
      },
      { $unwind: { path: "$reissued", preserveNullAndEmptyArrays: true } },
      {
        $set: {
          reissued: "$reissued.finalTotalOuts",
          reference: { $cond: { if: { $gt: ["$reissued.finalTotalOuts", 0] }, then: "$reissued.reference", else: "$$REMOVE" } },
        },
      },
      { $match: { $expr: { $and: [{ $ne: ["$reissued", null] }, { $gt: ["$reissued", 0] }] } } },
      ...(role === "personnel" && role
        ? [
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
            { $match: { "issueSlip.receivedBy": userId, "issueSlip.status": "issued" } },
          ]
        : []),
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return paginate(items, page, limit, length);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForWaste({ sort = {}, search = "", role = "" }: { sort?: TKeyValuePair; search?: string; role?: string }) {
    const query: any = { type: { $in: ["SEP", "PPE"] }, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      stockNumber: number;
      name: number;
      description: number;
      goodCondition?: number;
      reissued?: number;
      returned?: number;
    };

    const project: TProject = {
      stockNumber: 1,
      name: 1,
      description: 1,
    };

    if (["admin", "admin-head"].includes(role)) {
      project.goodCondition = 1;
      project.reissued = 1;
      project.returned = 1;
    }

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
            { $group: { _id: { itemNo: "$itemNo", assetId: "$assetId" }, totalOuts: { $sum: "$outs" } } },
          ],
          as: "goodCondition",
        },
      },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$assetId", "$$assetId"] },
                condition: { $in: ["reissued", "transferred", "returned", "for-disposal", "lost", "stolen", "damaged", "destroyed"] },
              },
            },
            { $group: { _id: { assetId: "$assetId", condition: "$condition" }, totalOuts: { $sum: "$outs" }, totalIns: { $sum: "$ins" } } },
            {
              $group: {
                _id: "$_id.assetId",
                reissuedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "reissued"] }, "$totalOuts", 0] } },
                transferredTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "transferred"] }, "$totalOuts", 0] } },
                returnedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "returned"] }, "$totalIns", 0] } },
                forDisposalTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "for-disposal"] }, "$totalOuts", 0] } },
                lostTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "lost"] }, "$totalOuts", 0] } },
                stolenTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "stolen"] }, "$totalOuts", 0] } },
                damagedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "damaged"] }, "$totalOuts", 0] } },
                destroyedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "destroyed"] }, "$totalOuts", 0] } },
              },
            },
            {
              $addFields: {
                finalTotalOuts: {
                  $max: [
                    0,
                    {
                      $subtract: [
                        "$reissuedTotal",
                        { $add: ["$returnedTotal", "$forDisposalTotal", "$lostTotal", "$stolenTotal", "$damagedTotal", "$destroyedTotal"] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "reissued",
        },
      },
      { $unwind: { path: "$reissued", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
            { $group: { _id: "$itemNo", totalIns: { $sum: "$ins" } } },
          ],
          as: "returned",
        },
      },
      { $unwind: { path: "$returned", preserveNullAndEmptyArrays: true } },
      {
        $set: {
          goodCondition: { $subtract: ["$quantity", { $size: "$goodCondition" }] },
          reissued: "$reissued.finalTotalOuts",
          returned: "$returned.totalIns",
        },
      },
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();

      return { items };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetsForMaintenance({
    sort = {},
    search = "",
    role = "",
    userId = "",
  }: {
    sort?: TKeyValuePair;
    search?: string;
    role?: string;
    userId?: string | ObjectId;
  }) {
    const query: any = { type: { $in: ["SEP", "PPE"] }, deletedAt: null };

    if (search) {
      query.$text = { $search: search };
    }

    userId = new ObjectId(userId);

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    type TProject = {
      stockNumber: number;
      name: number;
      description: number;
      reissued?: number;
    };

    const project: TProject = {
      stockNumber: 1,
      name: 1,
      description: 1,
    };

    if (role === "personnel") {
      project.reissued = 1;
    }

    const pipeLine: any[] = [
      { $match: query },
      { $match: { type: { $in: ["SEP", "PPE"] }, deletedAt: null } },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id", userId },
          as: "itemStocks",
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] } } },
            { $match: { condition: "reissued" } },
            {
              $lookup: {
                from: "issueSlips",
                let: { userId: "$$userId" },
                as: "issueSlip",
                pipeline: [
                  { $match: { $expr: { $eq: ["$issueSlipNo", "$reference"] } } },
                  { $match: { $expr: { $and: [{ $eq: ["$receivedBy", "$$userId"] }, { $eq: ["$status", "issued"] }] } } },
                ],
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          type: { $first: "$type" },
          entityName: { $first: "$entityName" },
          fundCluster: { $first: "$fundCluster" },
          name: { $first: "$name" },
          description: { $first: "$description" },
          unitOfMeasurement: { $first: "$unitOfMeasurement" },
          quantity: { $first: "$quantity" },
          propNumAttrib: { $first: "$propNumAttrib" },
          itemStocks: { $push: "$itemStocks" },
        },
      },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestCondition: { $first: "$condition" } } },
            {
              $group: {
                _id: "$_id.assetId",
                goodCondition: { $sum: { $cond: [{ $eq: ["$latestCondition", "good-condition"] }, 1, 0] } },
                reissued: { $sum: { $cond: [{ $eq: ["$latestCondition", "reissued"] }, 1, 0] } },
                transferred: { $sum: { $cond: [{ $eq: ["$latestCondition", "transferred"] }, 1, 0] } },
                returned: { $sum: { $cond: [{ $eq: ["$latestCondition", "returned"] }, 1, 0] } },
                forDisposal: { $sum: { $cond: [{ $eq: ["$latestCondition", "for-disposal"] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$latestCondition", "lost"] }, 1, 0] } },
                stolen: { $sum: { $cond: [{ $eq: ["$latestCondition", "stolen"] }, 1, 0] } },
                damaged: { $sum: { $cond: [{ $eq: ["$latestCondition", "damaged"] }, 1, 0] } },
                destroyed: { $sum: { $cond: [{ $eq: ["$latestCondition", "destroyed"] }, 1, 0] } },
              },
            },
          ],
          as: "stockConditions",
        },
      },
      { $addFields: { reissued: { $ifNull: [{ $arrayElemAt: ["$stockConditions.reissued", 0] }, 0] } } },
      { $match: { $expr: { $and: [{ $ne: ["$reissued", null] }, { $gt: ["$reissued", 0] }] } } },
    ];

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }];
    const pipelineForCount = [...pipeLine, { $count: "totalCount" }];

    try {
      const items = await collection.aggregate(pipelineForItems).toArray();
      const countResult = await collection.aggregate(pipelineForCount).toArray();
      const totalItems = countResult.length > 0 ? countResult[0].totalCount : 0;

      return { items, totalItems };
    } catch (error) {
      logger.error(`Error fetching assets for maintenance: ${error}`);
      throw error;
    }
  }

  async function getAssetsForDisposalReport({ sort = {}, type = "" } = {}) {
    const query: any = { type, deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    type TProject = {
      acquiredAt: string;
      name: number;
      stockNumber: number;
      quantity: string;
      cost: number;
      totalCost: any;
      accumulatedDepreciation?: any;
    };

    const project: TProject = {
      acquiredAt: "$createdAt",
      name: 1,
      stockNumber: 1,
      quantity: "$forDisposal",
      cost: 1,
      totalCost: { $multiply: ["$cost", "$forDisposal"] },
    };

    if (type === "PPE") {
      project.accumulatedDepreciation = { $round: ["$accumulatedDepreciation", 2] };
    }

    const pipeLine: any[] = [
      { $match: query },
      {
        $lookup: {
          from: "stocks",
          let: { assetId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "for-disposal" } },
            { $group: { _id: "$assetId", totalOuts: { $sum: "$outs" } } },
          ],
          as: "forDisposal",
        },
      },
      {
        $set: {
          forDisposal: { $ifNull: ["$forDisposal.totalOuts", 0] },
        },
      },
      { $unwind: { path: "$forDisposal", preserveNullAndEmptyArrays: true } },
      { $match: { $expr: { $and: [{ $ne: ["$forDisposal", null] }, { $gt: ["$forDisposal", 0] }] } } },
    ];

    if (type === "PPE") {
      pipeLine.push(
        {
          $lookup: {
            from: "assetCodes",
            localField: "propNumAttrib.propertyCode",
            foreignField: "code",
            as: "estimatedUsefulLife",
            pipeline: [{ $project: { year: 1 } }],
          },
        },
        { $unwind: { path: "$estimatedUsefulLife", preserveNullAndEmptyArrays: true } },
        {
          $set: {
            estimatedUsefulLife: { $toInt: { $ifNull: ["$estimatedUsefulLife.year", 0] } },
            salvageValue: { $multiply: ["$cost", 0.05] },
          },
        },
        { $set: { totalValue: { $subtract: ["$cost", "$salvageValue"] } } },
        {
          $set: {
            annualRate: {
              $cond: {
                if: { $eq: ["$estimatedUsefulLife", 0] },
                then: 0,
                else: { $divide: ["$totalValue", "$estimatedUsefulLife"] },
              },
            },
          },
        },
        { $set: { monthlyRate: { $divide: ["$annualRate", 12] } } },
        {
          $set: {
            accumulatedDepreciation: {
              $let: {
                vars: {
                  createdAt: { $toDate: "$createdAt" },
                  currentYearEnd: { $dateFromParts: { year: { $year: new Date() }, month: 12, day: 31 } },
                },
                in: {
                  $cond: [
                    { $lte: [{ $dayOfMonth: "$$createdAt" }, 15] },
                    { $multiply: ["$monthlyRate", { $subtract: [{ $month: "$$currentYearEnd" }, { $month: "$$createdAt" }] }] },
                    { $multiply: ["$monthlyRate", { $subtract: [{ $month: "$$currentYearEnd" }, { $month: "$$createdAt" }] }] },
                  ],
                },
              },
            },
          },
        },
      );
    }

    const pipelineForItems = [...pipeLine, { $project: project }, { $sort: sort }];

    try {
      const entityName = await configurationCollection.findOne({ name: "Entity Name" }, { projection: { value: 1 } });
      const fundCluster = await configurationCollection.findOne({ name: `Fund Cluster - ${type}` }, { projection: { value: 1 } });
      const items = await collection.aggregate(pipelineForItems).toArray();

      return {
        entityName: entityName?.value,
        fundCluster: fundCluster?.value,
        items,
      };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.findOne<TAsset>({ _id, deletedAt: null }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateAssetQtyById({ _id, qty } = {} as { _id: string | ObjectId; qty: number }, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { quantity: qty, updatedAt: new Date().toISOString() } }, { session });
      return "Successfully updated asset quantity.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateAssetById(_id: string | ObjectId, value: TAsset, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const existingCode = await collection.findOne({ type: value.type, name: value.name, _id: { $ne: _id }, deletedAt: null });
      if (existingCode) {
        throw new BadRequestError("Item name already exists.");
      }

      value.updatedAt = new Date().toISOString();

      await collection.updateOne({ _id }, { $set: value }, { session });
      return "Successfully updated asset.";
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Item name already exists.");
      }

      throw error;
    }
  }

  async function updatePropertyById(_id: string | ObjectId, value: Partial<TUpdatePropertyOptions>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const asset = await getAssetById(_id);
    if (!asset) {
      throw new BadRequestError("Asset not found.");
    }

    const existingCode = await collection.findOne({ type: asset.type, name: value.name, _id: { $ne: _id }, deletedAt: null });
    if (existingCode) {
      throw new BadRequestError("Item name already exists.");
    }

    const quantity = asset.propNumAttrib?.quantity ?? 0;
    const counter = asset.propNumAttrib?.counter ?? 0;

    const existingYear = asset.propNumAttrib?.year ?? "NA";
    const existingPropertyCode = asset.propNumAttrib?.propertyCode ?? "NA";
    const existingSerialNo = asset.propNumAttrib?.serialNumber ?? "NA";
    const existingLocation = asset.propNumAttrib?.location ?? "NA";

    try {
      const { name, description, year, propertyCode, serialCode, locationCode, unitOfMeasurement, condition } = value;

      // Initialize stockNumber only if necessary fields are provided
      let stockNumber: string | undefined;
      if (year || propertyCode || serialCode || locationCode) {
        stockNumber = `${year || existingYear}-${propertyCode || existingPropertyCode}-${serialCode || existingSerialNo}-${quantity}-${locationCode || existingLocation}-${counter}`;
      }

      // Construct the update object conditionally
      const updateData: {
        $set: Partial<TUpdatePropertyOptions> & {
          updatedAt: string;
          stockNumber?: string;
          "propNumAttrib.year"?: string;
          "propNumAttrib.propertyCode"?: string;
          "propNumAttrib.serialNumber"?: string;
          "propNumAttrib.location"?: string;
        };
      } = {
        $set: {
          ...(name && { name }),
          ...(description && { description }),
          ...(condition && { condition }),
          ...(unitOfMeasurement && { unitOfMeasurement }),
          updatedAt: new Date().toISOString(),
        },
      };

      // Add stockNumber and related fields only if it is constructed
      if (stockNumber) {
        Object.assign(updateData.$set, {
          "propNumAttrib.year": year,
          "propNumAttrib.propertyCode": propertyCode,
          "propNumAttrib.serialNumber": serialCode,
          "propNumAttrib.location": locationCode,
          stockNumber,
        });
      }

      // Update the document in the collection
      await collection.updateOne({ _id }, updateData, { session });

      // Ensure description and name are correctly accessed for lossCollection & maintenanceCollection
      const updatedDescription = updateData.$set.description ?? asset.description;
      const updatedName = updateData.$set.name ?? asset.name;

      await lossCollection.updateMany({ description: asset.description }, { $set: { description: updatedDescription } }, { session });
      await maintenanceCollection.updateMany({ name: asset.name }, { $set: { name: updatedName } }, { session });

      return "Successfully updated asset.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updatePropertyConditionById(_id: string | ObjectId, condition: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.updateOne({ _id }, { $set: { condition } }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteAssetById(_id: string | ObjectId, type: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      await collection.updateOne({ _id }, { $set: { deletedAt: new Date().toISOString() } }, { session });

      if (type === "SEP" || type === "PPE") {
        await stockCollection.updateOne({ assetId: _id }, { $set: { deletedAt: new Date().toISOString() } }, { session });
      }

      return "Successfully deleted asset.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetConsumables() {
    try {
      type TProject = {
        name: number;
        article: number;
        description: number;
        unitOfMeasurement: number;
        quantity: number;
        stockNumber: number;
        cost: number;
      };

      const project: TProject = {
        name: 1,
        article: 1,
        description: 1,
        unitOfMeasurement: 1,
        quantity: 1,
        stockNumber: 1,
        cost: 1,
      };

      const fundClusterValue = await configurationCollection.find({ name: "Fund Cluster - Consumable" }, { projection: { value: 1 } }).toArray();
      const items = await collection.find({ type: "consumable", quantity: { $ne: 0 } }, { projection: project }).toArray();
      return {
        items,
        fundCluster: fundClusterValue[0].value,
      };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getAssetSEPPPE(type: string, search?: string, condition?: string) {
    try {
      const query: any = { type, deletedAt: null };

      if (search) {
        query["propNumAttrib.propertyCode"] = search;
      }

      const matchCondition = condition
        ? condition === "good-condition"
          ? { goodCondition: { $gt: 0 } }
          : { [condition]: { $exists: true, $ne: null } }
        : {};

      type TProject = {
        name: number;
        article: number;
        description: number;
        unitOfMeasurement: number;
        stockNumber: number;
        cost: number;
        quantity: number | string;
        propertyCode: string;
      };

      let project: TProject = {
        name: 1,
        article: 1,
        description: 1,
        unitOfMeasurement: 1,
        stockNumber: 1,
        quantity: 1,
        cost: 1,
        propertyCode: "$propNumAttrib.propertyCode",
      };

      if (!condition) {
        project.quantity = 1;
      } else if (condition === "reissued") {
        project.quantity = "$reissued";
      } else if (condition === "returned") {
        project.quantity = "$returned";
      } else if (condition === "good-condition") {
        project.quantity = "$goodCondition";
      }

      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "stocks",
            let: { assetId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
              { $group: { _id: { itemNo: "$itemNo", assetId: "$assetId" }, totalOuts: { $sum: "$outs" } } },
            ],
            as: "goodCondition",
          },
        },
        {
          $lookup: {
            from: "stocks",
            let: { assetId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$assetId", "$$assetId"] },
                  condition: { $in: ["reissued", "transferred", "returned", "for-disposal", "lost", "stolen", "damaged", "destroyed"] },
                },
              },
              { $group: { _id: { assetId: "$assetId", condition: "$condition" }, totalOuts: { $sum: "$outs" }, totalIns: { $sum: "$ins" } } },
              {
                $group: {
                  _id: "$_id.assetId",
                  reissuedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "reissued"] }, "$totalOuts", 0] } },
                  transferredTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "transferred"] }, "$totalOuts", 0] } },
                  returnedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "returned"] }, "$totalIns", 0] } },
                  forDisposalTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "for-disposal"] }, "$totalOuts", 0] } },
                  lostTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "lost"] }, "$totalOuts", 0] } },
                  stolenTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "stolen"] }, "$totalOuts", 0] } },
                  damagedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "damaged"] }, "$totalOuts", 0] } },
                  destroyedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "destroyed"] }, "$totalOuts", 0] } },
                },
              },
              {
                $addFields: {
                  finalTotalOuts: {
                    $max: [
                      0,
                      {
                        $subtract: [
                          "$reissuedTotal",
                          { $add: ["$returnedTotal", "$forDisposalTotal", "$lostTotal", "$stolenTotal", "$damagedTotal", "$destroyedTotal"] },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            as: "reissued",
          },
        },
        { $unwind: { path: "$reissued", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "stocks",
            let: { assetId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "returned" } },
              { $group: { _id: "$itemNo", totalIns: { $sum: "$ins" } } },
            ],
            as: "returned",
          },
        },
        { $unwind: { path: "$returned", preserveNullAndEmptyArrays: true } },
        {
          $set: {
            goodCondition: {
              $cond: {
                if: { $eq: [{ $subtract: ["$quantity", { $size: "$goodCondition" }] }, 0] },
                then: "$$REMOVE",
                else: { $subtract: ["$quantity", { $size: "$goodCondition" }] },
              },
            },
            reissued: {
              $cond: { if: { $eq: ["$reissued.finalTotalOuts", 0] }, then: "$$REMOVE", else: "$reissued.finalTotalOuts" },
            },
            returned: {
              $cond: { if: { $eq: ["$returned.totalIns", 0] }, then: "$$REMOVE", else: "$returned.totalIns" },
            },
          },
        },
        {
          $match: {
            $and: [matchCondition, { quantity: { $gt: 0 } }],
          },
        },
        { $project: project },
      ];

      const items = await collection.aggregate(pipeline).toArray();

      const fundClusterValue = await configurationCollection.findOne({ name: `Fund Cluster - ${type}` }, { projection: { value: 1 } });

      return {
        fundCluster: fundClusterValue?.value || "",
        items,
      };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createUniqueIndex,
    createAsset,
    getAssets,
    getAssetsForTransfer,
    getAssetsForReturn,
    getAssetsForWaste,
    getAssetsForMaintenance,
    getAssetsForDisposalReport,
    getAssetById,
    getAssetConsumables,
    getAssetSEPPPE,
    updateAssetQtyById,
    updateAssetById,
    updatePropertyById,
    updatePropertyConditionById,
    deleteAssetById,
  };
}
