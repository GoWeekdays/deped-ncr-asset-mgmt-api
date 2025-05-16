import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MLoss, TLoss } from "./../models/loss.model";

export default function useLossRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("losses");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { type: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ lossNo: "text", description: "text", officeName: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ "itemStocks.stockId": 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createLoss(value: TLoss, session?: ClientSession) {
    const loss = new MLoss(value);

    try {
      const res = await collection.insertOne(loss, { session });

      if (!res.insertedId) {
        throw new BadRequestError("Failed to fetch newly created loss details.");
      }

      return await getLossByIdForApproval(res.insertedId);
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Loss already exists.");
      }

      throw error;
    }
  }

  async function getLosses({
    page = 1,
    limit = 10,
    sort = {},
    search = "",
    type = "",
    role = "",
    userId = "",
    status = "",
  }: {
    page: number;
    limit: number;
    sort: {};
    search: string;
    type: string;
    role: string;
    userId: string | ObjectId;
    status: string;
  }) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { type };

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: `"${search}"` };
    }

    if (["pending", "approved", "completed"].includes(status)) {
      query.status = status;
    }

    if (typeof userId === "string") {
      userId = new ObjectId(userId);
    }

    const project = {
      createdAt: 1,
      lossNo: 1,
      description: 1,
      officeName: 1,
      status: 1,
    };

    const pipeLine = [
      { $match: query },
      { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "stocks",
          localField: "itemStocks.stockId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
                pipeline: [
                  {
                    $lookup: {
                      from: "assets",
                      localField: "assetId",
                      foreignField: "_id",
                      as: "asset",
                      pipeline: [{ $project: { description: 1 } }],
                    },
                  },
                  { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "users",
                      localField: "receivedBy",
                      foreignField: "_id",
                      as: "officer",
                      pipeline: [{ $project: { officeId: 1 } }],
                    },
                  },
                  { $unwind: { path: "$officer", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "offices",
                      localField: "officer.officeId",
                      foreignField: "_id",
                      as: "office",
                      pipeline: [{ $project: { name: 1 } }],
                    },
                  },
                  { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "users",
                      localField: "officer.officeId",
                      foreignField: "officeId",
                      as: "supervisor",
                      pipeline: [{ $match: { type: "office-chief" } }],
                    },
                  },
                  { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
                  {
                    $project: {
                      description: "$asset.description",
                      officeName: "$office.name",
                      supervisorId: "$supervisor._id",
                      receivedBy: 1,
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
          ],
          as: "itemStocks",
        },
      },
      ...(role === "office-chief" && userId
        ? [{ $match: { "itemStocks.issueSlip.supervisorId": userId } }]
        : role === "admin" || role === "admin-head"
          ? []
          : userId
            ? [{ $match: { "itemStocks.issueSlip.receivedBy": userId } }]
            : []),
      {
        $group: {
          _id: "$_id",
          createdAt: { $first: "$createdAt" },
          lossNo: { $first: "$lossNo" },
          description: { $first: { $arrayElemAt: ["$itemStocks.issueSlip.description", 0] } },
          officeName: { $first: { $arrayElemAt: ["$itemStocks.issueSlip.officeName", 0] } },
          status: { $first: "$status" },
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

  async function getLossById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      entityName: 1,
      fundCluster: 1,
      officerName: 1,
      officerDesignation: 1,
      lossNo: 1,
      lossStatus: 1,
      officeId: 1,
      officeName: 1,
      createdAt: 1,
      issueSlipNo: 1,
      issuedAt: 1,
      status: 1,
      policeNotified: 1,
      policeStation: 1,
      circumstances: 1,
      policeReportDate: 1,
      attachment: 1,
      supervisorName: 1,
      supervisorDate: 1,
      governmentId: 1,
      governmentIdNo: 1,
      governmentIdDate: 1,
      "itemStocks.stockId": 1,
      "itemStocks.itemNo": 1,
      "itemStocks.stockNumber": 1,
      "itemStocks.description": 1,
      "itemStocks.cost": 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "stocks",
          localField: "itemStocks.stockId",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
                pipeline: [
                  {
                    $lookup: {
                      from: "assets",
                      localField: "assetId",
                      foreignField: "_id",
                      as: "asset",
                      pipeline: [
                        {
                          $project: {
                            stockNumber: 1,
                            description: 1,
                            cost: 1,
                          },
                        },
                      ],
                    },
                  },
                  { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "users",
                      localField: "receivedBy",
                      foreignField: "_id",
                      as: "officer",
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
                            designation: 1,
                            officeId: 1,
                          },
                        },
                      ],
                    },
                  },
                  { $unwind: { path: "$officer", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "offices",
                      localField: "officer.officeId",
                      foreignField: "_id",
                      as: "office",
                      pipeline: [
                        {
                          $lookup: {
                            from: "users",
                            localField: "supervisorId",
                            foreignField: "_id",
                            as: "supervisor",
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
                        { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
                        { $project: { name: 1, supervisorName: "$supervisor.name" } },
                      ],
                    },
                  },
                  { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
                  {
                    $project: {
                      officeId: "$office._id",
                      officeName: "$office.name",
                      officerName: "$officer.name",
                      officerDesignation: "$officer.designation",
                      supervisorName: "$office.supervisorName",
                      issuedAt: "$createdAt",
                      issueSlipNo: 1,
                      stockNumber: "$asset.stockNumber",
                      description: "$asset.description",
                      cost: "$asset.cost",
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                stockId: "$_id",
                itemNo: 1,
                officeId: "$issueSlip.officeId",
                officeName: "$issueSlip.officeName",
                officerName: "$issueSlip.officerName",
                officerDesignation: "$issueSlip.officerDesignation",
                supervisorName: "$issueSlip.supervisorName",
                issuedAt: "$issueSlip.issuedAt",
                issueSlipNo: "$issueSlip.issueSlipNo",
                stockNumber: "$issueSlip.stockNumber",
                description: "$issueSlip.description",
                cost: "$issueSlip.cost",
              },
            },
          ],
          as: "itemStocks",
        },
      },
      {
        $group: {
          _id: "$_id",
          entityName: { $first: "$entityName" },
          fundCluster: { $first: "$fundCluster" },
          officerName: { $first: { $arrayElemAt: ["$itemStocks.officerName", 0] } },
          officerDesignation: { $first: { $arrayElemAt: ["$itemStocks.officerDesignation", 0] } },
          lossNo: { $first: "$lossNo" },
          lossStatus: { $first: "$lossStatus" },
          officeId: { $first: { $arrayElemAt: ["$itemStocks.officeId", 0] } },
          officeName: { $first: { $arrayElemAt: ["$itemStocks.officeName", 0] } },
          createdAt: { $first: "$createdAt" },
          issueSlipNo: { $first: { $arrayElemAt: ["$itemStocks.issueSlipNo", 0] } },
          issuedAt: { $first: { $arrayElemAt: ["$itemStocks.issuedAt", 0] } },
          status: { $first: "$status" },
          policeNotified: { $first: "$policeNotified" },
          policeStation: { $first: "$policeStation" },
          circumstances: { $first: "$circumstances" },
          policeReportDate: { $first: "$policeReportDate" },
          attachment: { $first: "$attachment" },
          supervisorName: { $first: { $arrayElemAt: ["$itemStocks.supervisorName", 0] } },
          supervisorDate: { $first: "$supervisorDate" },
          governmentId: { $first: "$governmentId" },
          governmentIdNo: { $first: "$governmentIdNo" },
          governmentIdDate: { $first: "$governmentIdDate" },
          itemStocks: { $first: "$itemStocks" },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate<TLoss>(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getLossByIdForApproval(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      lossStatus: 1,
      itemName: 1,
      officerName: 1,
      officeName: 1,
      type: 1,
      supervisorName: 1,
      supervisorEmail: 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "stocks",
          localField: "itemStocks.stockId",
          foreignField: "_id",
          pipeline: [
            { $project: { _id: 0, stockId: "$_id", reference: 1 } },
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
                pipeline: [
                  {
                    $lookup: {
                      from: "assets",
                      localField: "assetId",
                      foreignField: "_id",
                      as: "asset",
                      pipeline: [{ $project: { name: 1 } }],
                    },
                  },
                  { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "users",
                      localField: "receivedBy",
                      foreignField: "_id",
                      as: "officer",
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
                            officeId: 1,
                          },
                        },
                      ],
                    },
                  },
                  { $unwind: { path: "$officer", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "offices",
                      localField: "officer.officeId",
                      foreignField: "_id",
                      as: "office",
                      pipeline: [
                        {
                          $lookup: {
                            from: "users",
                            localField: "supervisorId",
                            foreignField: "_id",
                            as: "supervisor",
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
                                  email: 1,
                                },
                              },
                            ],
                          },
                        },
                        { $unwind: { path: "$supervisor", preserveNullAndEmptyArrays: true } },
                        {
                          $project: {
                            name: 1,
                            supervisorName: "$supervisor.name",
                            supervisorEmail: "$supervisor.email",
                          },
                        },
                      ],
                    },
                  },
                  { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
                  {
                    $project: {
                      itemName: "$asset.name",
                      officeName: "$office.name",
                      officerName: "$officer.name",
                      supervisorName: "$office.supervisorName",
                      supervisorEmail: "$office.supervisorEmail",
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                stockId: "$_id",
                itemName: "$issueSlip.itemName",
                officeName: "$issueSlip.officeName",
                officerName: "$issueSlip.officerName",
                supervisorName: "$issueSlip.supervisorName",
                supervisorEmail: "$issueSlip.supervisorEmail",
              },
            },
          ],
          as: "itemStocks",
        },
      },
      {
        $group: {
          _id: "$_id",
          lossStatus: { $first: "$lossStatus" },
          itemName: { $first: { $arrayElemAt: ["$itemStocks.itemName", 0] } },
          officerName: { $first: { $arrayElemAt: ["$itemStocks.officerName", 0] } },
          officeName: { $first: { $arrayElemAt: ["$itemStocks.officeName", 0] } },
          type: { $first: "$type" },
          supervisorName: { $first: { $arrayElemAt: ["$itemStocks.supervisorName", 0] } },
          supervisorEmail: { $first: { $arrayElemAt: ["$itemStocks.supervisorEmail", 0] } },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getLossByIdForStock(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      assetId: 1,
      officeId: 1,
      lossStatus: 1,
      "itemStocks.stockId": 1,
      "itemStocks.reference": 1,
      "itemStocks.serialNo": 1,
      "itemStocks.condition": 1,
      "itemStocks.itemNo": 1,
    };

    const pipeLine = [
      { $match: { _id } },
      {
        $lookup: {
          from: "stocks",
          localField: "itemStocks.stockId",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                _id: 0,
                stockId: "$_id",
                reference: 1,
                serialNo: 1,
                condition: 1,
                itemNo: 1,
              },
            },
            {
              $lookup: {
                from: "issueSlips",
                localField: "reference",
                foreignField: "issueSlipNo",
                as: "issueSlip",
                pipeline: [
                  {
                    $lookup: {
                      from: "assets",
                      localField: "assetId",
                      foreignField: "_id",
                      as: "asset",
                      pipeline: [{ $project: { _id: 1 } }],
                    },
                  },
                  { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "users",
                      localField: "receivedBy",
                      foreignField: "_id",
                      as: "officer",
                      pipeline: [{ $project: { officeId: 1 } }],
                    },
                  },
                  { $unwind: { path: "$officer", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "offices",
                      localField: "officer.officeId",
                      foreignField: "_id",
                      as: "office",
                    },
                  },
                  { $unwind: { path: "$office", preserveNullAndEmptyArrays: true } },
                  {
                    $project: {
                      assetId: "$asset._id",
                      officeId: "$office._id",
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$issueSlip", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                stockId: 1,
                reference: 1,
                serialNo: 1,
                condition: 1,
                itemNo: 1,
                assetId: "$issueSlip.assetId",
                officeId: "$issueSlip.officeId",
              },
            },
          ],
          as: "itemStocks",
        },
      },
      {
        $group: {
          _id: "$_id",
          assetId: { $first: { $arrayElemAt: ["$itemStocks.assetId", 0] } },
          officeId: { $first: { $arrayElemAt: ["$itemStocks.officeId", 0] } },
          lossStatus: { $first: "$lossStatus" },
          itemStocks: { $first: "$itemStocks" },
        },
      },
      { $project: project },
    ];

    try {
      const res = await collection.aggregate(pipeLine, { session }).toArray();
      return res[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateLossById(_id: string | ObjectId, status: string, supervisorDate?: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const updateOptions = { status, supervisorDate, updatedAt: new Date().toISOString() };

    try {
      const result = await collection.updateOne({ _id }, { $set: updateOptions }, { session });
      if (result.modifiedCount === 0) {
        throw new BadRequestError("No records were updated.");
      }
      return result;
    } catch (error: any) {
      logger.log({ level: "error", message: `Update failed: ${error}` });

      const isDuplicated = error.message.includes("duplicate");

      if (isDuplicated) {
        throw new BadRequestError("Issue slip already exists");
      }

      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createUniqueIndex,
    createLoss,
    getLosses,
    getLossById,
    getLossByIdForStock,
    updateLossById,
  };
}
