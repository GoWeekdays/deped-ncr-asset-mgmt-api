import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { ClientSession, ObjectId } from "mongodb";
import { TKeyValuePair } from "./../local";
import { MStock, TStock } from "./../models/stock.model";

export default function useStockRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("stocks");
  const officeCollection = atlas.getDb().collection("offices");
  const userCollection = atlas.getDb().collection("users");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { assetId: 1 } }, { key: { itemNo: 1 } }, { key: { condition: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ assetName: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createStock(value: TStock, session?: ClientSession) {
    const stock = new MStock(value);

    try {
      return await collection.insertOne(stock, { session });
    } catch (error) {
      logger.log({ level: "error", message: `Error in repository createStock: ${error}` });
      throw error;
    }
  }

  async function getStocks({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = {};

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    const pipeLine = [{ $match: query }];

    const pipelineForItems = [...pipeLine, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
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

  async function getStocksByAssetId({ page = 1, limit = 10, sort = {}, search = "", asset = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    if (typeof asset === "string") {
      query.assetId = new ObjectId(asset);
    }

    sort = Object.keys(sort).length > 0 ? sort : { _id: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      assetId: 1,
      reference: 1,
      serialNo: 1,
      numberOfDaysToConsume: 1,
      ins: 1,
      outs: 1,
      balance: 1,
      cost: "$asset.cost",
      description: "$asset.description",
      unitOfMeasurement: "$asset.unitOfMeasurement",
      itemNo: 1,
      officeId: 1,
      office: {
        $cond: {
          if: { $and: [{ $ne: ["$officeName", ""] }, { $ifNull: ["$officeName", false] }] },
          then: "$officeName",
          else: "$office.name",
        },
      },
      remarks: 1,
      attachment: 1,
      condition: 1,
      createdAt: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                cost: 1,
                description: 1,
                unitOfMeasurement: 1,
              },
            },
          ],
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "offices",
          localField: "officeId",
          foreignField: "_id",
          as: "office",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
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

  async function getStocksByCondition({ page = 1, limit = 10, sort = {}, search = "", asset = "", condition = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    if (typeof asset === "string") {
      query.assetId = new ObjectId(asset);
    }

    sort = Object.keys(sort).length > 0 ? sort : { itemNo: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      createdAt: string;
      reference?: number;
      itemNo: number;
      name: string;
      description: string;
      cost: string;
      condition: number;
    };

    const project: TProject = {
      createdAt: "$asset.createdAt",
      ...(condition === "reissued" && { reference: 1 }),
      itemNo: 1,
      name: "$asset.name",
      description: "$asset.description",
      cost: "$asset.cost",
      condition: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition } },
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

  async function getReissuedStocksForLoss({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    issueSlipId = "",
  }: {
    page?: number;
    limit?: number;
    sort?: TKeyValuePair;
    search?: string;
    issueSlipId?: string | ObjectId;
  } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    sort = Object.keys(sort).length > 0 ? sort : { itemNo: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof issueSlipId === "string") {
      issueSlipId = new ObjectId(issueSlipId);
    }

    const project = {
      _id: 0,
      stockId: "$_id",
      stockNumber: "$asset.stockNumber",
      itemNo: 1,
      description: "$asset.description",
      cost: "$asset.cost",
      issuedAt: "$issueSlip.issuedAt",
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition: { $in: ["reissued"] } } },
      {
        $lookup: {
          from: "issueSlips",
          localField: "reference",
          foreignField: "issueSlipNo",
          pipeline: [{ $project: { issuedAt: "$receivedAt" } }],
          as: "issueSlip",
        },
      },
      { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
      { $match: { "issueSlip._id": issueSlipId } },
      {
        $lookup: {
          from: "losses",
          let: { stockId: "$_id" },
          pipeline: [{ $unwind: "$itemStocks" }, { $match: { $expr: { $eq: ["$itemStocks.stockId", "$$stockId"] } } }],
          as: "lossMatch",
        },
      },
      { $match: { lossMatch: { $size: 0 } } },
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

  async function getReissuedStocksForReturn({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    assetId = "",
  }: {
    page?: number;
    limit?: number;
    sort?: TKeyValuePair;
    search?: string;
    assetId?: string | ObjectId;
  } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    sort = Object.keys(sort).length > 0 ? sort : { itemNo: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof assetId === "string") {
      query.assetId = new ObjectId(assetId);
    }

    const project = {
      _id: 0,
      stockId: "$_id",
      itemNo: 1,
      name: "$asset.name",
      reference: 1,
      endUser: "$endUser.name",
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition: { $in: ["reissued"] } } },
      {
        $lookup: {
          from: "issueSlips",
          localField: "reference",
          foreignField: "issueSlipNo",
          pipeline: [{ $project: { receivedBy: 1 } }],
          as: "issueSlip",
        },
      },
      { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "issueSlip.receivedBy",
          foreignField: "_id",
          as: "endUser",
          pipeline: [
            {
              $project: {
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
                        "$firstName",
                        " ",
                        "$lastName",
                        { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      },
      { $unwind: { path: "$endUser", preserveNullAndEmptyArrays: true } },
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

  async function getStocksByWasteCondition({ page = 1, limit = 10, sort = {}, search = "", assetId = "", condition = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    if (typeof assetId === "string") {
      query.assetId = new ObjectId(assetId);
    }

    sort = Object.keys(sort).length > 0 ? sort : { itemNo: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    type TProject = {
      itemNo: number;
      condition: number;
      name: string;
      stockNumber: string;
      unitOfMeasurement: string;
    };

    const project: TProject = {
      itemNo: 1,
      condition: 1,
      name: "$asset.name",
      stockNumber: "$asset.stockNumber",
      unitOfMeasurement: "$asset.unitOfMeasurement",
    };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition } },
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

  async function getReissuedStocksForMaintenance({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    assetId = "",
    role = "",
    userId = "",
  }: {
    page?: number;
    limit?: number;
    sort?: TKeyValuePair;
    search?: string;
    assetId?: string | ObjectId;
    role: string;
    userId: string | ObjectId;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    sort = Object.keys(sort).length > 0 ? sort : { itemNo: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof assetId === "string") {
      query.assetId = new ObjectId(assetId);
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    const project = { itemNo: "$itemNo" };

    const pipeLine = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition: { $in: ["reissued"] } } },
      {
        $lookup: {
          from: "maintenances",
          localField: "_id",
          foreignField: "stockId",
          as: "maintenanceMatch",
          pipeline: [{ $match: { status: "pending" } }],
        },
      },
      { $match: { maintenanceMatch: { $size: 0 } } },
      ...(role === "office-chief"
        ? [
            {
              $lookup: {
                from: "users",
                let: { userId, officeId: "$officeId" },
                pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$officeId", "$$officeId"] }, { $eq: ["$type", "office-chief"] }] } } }],
                as: "supervisor",
              },
            },
            { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$officeId", "$supervisor.officeId"] } } },
          ]
        : []),
      ...(role === "personnel"
        ? [
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
                pipeline: [{ $match: { receivedBy: userId, status: "issued" } }],
              },
            },
            { $match: { issueSlip: { $ne: [] } } },
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

  async function getStockById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.findOne<TStock>({ _id }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPropertyByOfficeId({
    officeId,
    page = 1,
    limit = 10,
    search = "",
  }: {
    officeId: string | ObjectId;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    page = page > 0 ? page - 1 : 0;

    if (typeof officeId === "string") {
      officeId = new ObjectId(officeId);
    }

    const query: TKeyValuePair = { officeId };

    if (search) {
      query.$text = { $search: search };
    }

    const officeResult = await officeCollection
      .aggregate([
        { $match: { _id: officeId } },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "officeId",
            as: "supervisor",
            pipeline: [
              { $match: { type: "office-chief" } },
              {
                $project: {
                  name: {
                    $trim: {
                      input: {
                        $concat: [
                          { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
                          "$firstName",
                          " ",
                          "$lastName",
                          { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
                        ],
                      },
                    },
                  },
                  email: 1,
                },
              },
            ],
          },
        },
        { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "divisions",
            localField: "divisionId",
            foreignField: "_id",
            as: "division",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            officerName: "$supervisor.name",
            officerEmail: "$supervisor.email",
            officeName: "$name",
            divisionName: "$division.name",
          },
        },
      ])
      .toArray();

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $match: { "asset.type": { $in: ["SEP", "PPE"] } } },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { assetId: "$assetId", itemNo: "$itemNo" },
          latestStock: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition: "reissued" } },
      { $match: { $expr: { $and: [{ $ne: ["$outs", null] }, { $gt: ["$outs", 0] }] } } },
      {
        $lookup: {
          from: "issueSlips",
          localField: "reference",
          foreignField: "issueSlipNo",
          as: "issueSlip",
          pipeline: [{ $project: { receivedBy: 1, receivedAt: 1 } }],
        },
      },
      { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "issueSlip.receivedBy",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
                        "$firstName",
                        " ",
                        "$lastName",
                        { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
                      ],
                    },
                  },
                },
              },
            },
          ],
          as: "personnel",
        },
      },
      { $unwind: { path: "$personnel", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { assetId: "$asset._id", reference: "$reference" },
          name: { $first: "$asset.name" },
          quantity: { $sum: "$outs" },
          issuedAt: { $first: "$issueSlip.receivedAt" },
          personnel: { $first: "$personnel.name" },
        },
      },
      { $sort: { name: 1, "_id.reference": 1 } },
      {
        $project: {
          _id: 0,
          name: 1,
          quantity: 1,
          issuedAt: 1,
          reference: "$_id.reference",
          personnel: 1,
        },
      },
      {
        $group: {
          _id: null,
          items: { $push: "$$ROOT" },
          totalItemsOwned: { $sum: "$quantity" },
        },
      },
    ];

    const pipelineForItems = [...pipeline, { $project: { _id: 0, items: 1 } }, { $unwind: "$items" }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeline, { $project: { _id: 0, items: 1 } }, { $unwind: "$items" }, { $count: "totalCount" }];
    const countsPipeline = [
      ...pipeline,
      {
        $project: {
          _id: 0,
          totalItemsOwned: 1,
        },
      },
    ];

    try {
      const [itemsResult, countResult, countsResult] = await Promise.all([
        collection.aggregate(pipelineForItems).toArray(),
        collection.aggregate(pipelineForCount).toArray(),
        collection.aggregate(countsPipeline).toArray(),
      ]);

      const items = itemsResult.map((doc) => doc.items);
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return {
        _id: officeId,
        ...(officeResult[0] || {}),
        ...(countsResult[0] || { totalItemsOwned: 0 }),
        ...paginate(items, page, limit, length),
      };
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching property by officeId: ${error}` });
      throw error;
    }
  }

  async function updateStockAssetNameByAssetId(assetId: string | ObjectId, assetName: string) {
    if (typeof assetId === "string") {
      assetId = new ObjectId(assetId);
    }

    try {
      await collection.updateMany({ assetId }, { $set: { assetName: assetName } });
      return "Successfully updated asset names";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPersonnelStockCardById({
    userId,
    page = 1,
    limit = 10,
    search = "",
  }: {
    userId: string | ObjectId;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: TKeyValuePair = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    type TUserProject = {
      email: number;
      type: number;
      status: number;
      attachment: number;
      name: any;
      officeName: string;
    };

    const userProject: TUserProject = {
      email: 1,
      type: 1,
      status: 1,
      attachment: 1,
      name: {
        $trim: {
          input: {
            $concat: [
              { $cond: { if: { $ne: ["$title", ""] }, then: { $concat: ["$title", " "] }, else: "" } },
              "$firstName",
              { $cond: { if: { $ne: ["$middleName", ""] }, then: { $concat: [" ", "$middleName"] }, else: "" } },
              " ",
              "$lastName",
              { $cond: { if: { $ne: ["$suffix", ""] }, then: { $concat: [" ", "$suffix"] }, else: "" } },
            ],
          },
        },
      },
      officeName: "$office.name",
    };

    const userResult = await userCollection
      .aggregate([
        { $match: { _id: userId, deletedAt: null } },
        {
          $lookup: {
            from: "offices",
            localField: "officeId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1 } }],
            as: "office",
          },
        },
        { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
        { $project: userProject },
      ])
      .toArray();

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "assets",
          localField: "assetId",
          foreignField: "_id",
          as: "asset",
        },
      },
      { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
      { $match: { "asset.type": { $in: ["SEP", "PPE"] } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { assetId: "$assetId", itemNo: "$itemNo" }, latestStock: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$latestStock" } },
      { $match: { condition: "reissued" } },
      { $match: { $expr: { $and: [{ $ne: ["$outs", null] }, { $gt: ["$outs", 0] }] } } },
      {
        $lookup: {
          from: "issueSlips",
          localField: "reference",
          foreignField: "issueSlipNo",
          as: "issueSlip",
        },
      },
      { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
      { $match: { "issueSlip.receivedBy": userId } },
      {
        $group: {
          _id: "$asset._id",
          name: { $first: "$asset.name" },
          type: { $first: "$asset.type" },
          condition: { $first: "$condition" },
          totalQuantity: { $sum: "$outs" },
          date: { $max: "$createdAt" },
        },
      },
      { $sort: { name: 1 } },
      {
        $project: {
          _id: 0,
          assetId: "$_id",
          name: 1,
          type: 1,
          condition: 1,
          quantity: "$totalQuantity",
          date: 1,
        },
      },
      {
        $group: {
          _id: null,
          items: { $push: "$$ROOT" },
        },
      },
      { $project: { _id: 0, items: 1 } },
    ];

    const pipelineForItems = [...pipeline, { $unwind: "$items" }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeline, { $unwind: "$items" }, { $count: "totalCount" }];
    const countsPipeline = [
      ...pipeline,
      {
        $project: {
          _id: 0,
          sepCount: { $size: { $filter: { input: "$items", as: "asset", cond: { $eq: ["$$asset.type", "SEP"] } } } },
          ppeCount: { $size: { $filter: { input: "$items", as: "asset", cond: { $eq: ["$$asset.type", "PPE"] } } } },
        },
      },
    ];

    try {
      const [itemsResult, countResult, countsResult] = await Promise.all([
        collection.aggregate(pipelineForItems).toArray(),
        collection.aggregate(pipelineForCount).toArray(),
        collection.aggregate(countsPipeline).toArray(),
      ]);

      const items = itemsResult.map((doc) => doc.items);
      const length = countResult.length > 0 ? countResult[0].totalCount : 0;

      return {
        _id: userId,
        ...(userResult[0] || {}),
        ...countsResult[0],
        ...paginate(items, page, limit, length),
      };
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createStock,
    getStocks,
    getStocksByAssetId,
    getStocksByCondition,
    getReissuedStocksForLoss,
    getReissuedStocksForReturn,
    getStocksByWasteCondition,
    getReissuedStocksForMaintenance,
    getStockById,
    getPropertyByOfficeId,
    updateStockAssetNameByAssetId,
    getPersonnelStockCardById,
  };
}
