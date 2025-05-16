import { ClientSession, ObjectId } from "mongodb";
import { logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MWaste, TWaste } from "./../models/waste.model";

export default function useWasteRepository() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("wastes");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { placeOfStorage: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ placeOfStorage: "text" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createWaste(value: TWaste, session?: ClientSession) {
    const waste = new MWaste(value);

    try {
      await collection.insertOne(waste, { session });

      return "Successfully created new waste.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getWastes({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = {};

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: `"${search}"` };
    }

    const project = {
      _id: 1,
      placeOfStorage: 1,
      createdAt: 1,
      status: 1,
    };

    const pipeline = [{ $match: query }];

    const pipelineForItems = [...pipeline, { $project: project }, { $sort: sort }, { $skip: page * limit }, { $limit: limit }];
    const pipelineForCount = [...pipeline, { $count: "totalCount" }];

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

  async function getWasteById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      const project = {
        entityName: 1,
        fundCluster: 1,
        placeOfStorage: 1,
        status: 1,
        witnessedByName: 1,
        certifiedByName: 1,
        certifiedByDesignation: 1,
        disposalApprovedByName: 1,
        disposalApprovedByDesignation: 1,
        itemStocks: 1,
        soldAtPrivateSaleCount: 1,
        soldAtPublicAuctionCount: 1,
        transferredWithoutCostCount: 1,
        destroyedCount: 1,
        transferredTo: {
          $cond: {
            if: {
              $gt: [{ $size: { $filter: { input: "$itemStocks", as: "item", cond: { $eq: ["$$item.type", "transferred-without-cost"] } } } }, 0],
            },
            then: { $first: "$itemStocks.transferredTo" },
            else: "",
          },
        },
      };

      const pipeline = [
        { $match: { _id } },
        {
          $lookup: {
            from: "users",
            let: { userId: "$certifiedBy" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
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
                },
              },
            ],
            as: "certifiedByDetails",
          },
        },
        {
          $unwind: {
            path: "$certifiedByDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$disposalApprovedBy" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
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
                },
              },
            ],
            as: "disposalApprovedByDetails",
          },
        },
        { $unwind: { path: "$disposalApprovedByDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "stocks",
            let: {
              stockId: "$itemStocks.stockId",
              wasteType: "$itemStocks.type",
              wasteRemarks: "$itemStocks.remarks",
              transferredTo: "$itemStocks.transferredTo",
            },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$stockId"] } } },
              {
                $lookup: {
                  from: "assets",
                  localField: "assetId",
                  foreignField: "_id",
                  as: "asset",
                },
              },
              { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 0,
                  stockId: "$_id",
                  stockNumber: "$asset.stockNumber",
                  name: "$asset.name",
                  description: "$asset.description",
                  type: "$$wasteType",
                  unitOfMeasurement: "$asset.unitOfMeasurement",
                  remarks: "$$wasteRemarks",
                  transferredTo: {
                    $cond: {
                      if: {
                        $eq: ["$$wasteType", "transferred-without-cost"],
                      },
                      then: "$$transferredTo",
                      else: "",
                    },
                  },
                },
              },
            ],
            as: "itemStocks",
          },
        },
        { $unwind: { path: "$itemStocks", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$_id",
            entityName: { $first: "$entityName" },
            fundCluster: { $first: "$fundCluster" },
            placeOfStorage: { $first: "$placeOfStorage" },
            status: { $first: "$status" },
            itemStocks: { $push: "$itemStocks" },
            certifiedByName: { $first: "$certifiedByDetails.name" },
            certifiedByDesignation: { $first: "$certifiedByDetails.designation" },
            disposalApprovedByName: { $first: "$disposalApprovedByDetails.name" },
            disposalApprovedByDesignation: { $first: "$disposalApprovedByDetails.designation" },
            witnessedByName: { $first: "$witnessedByName" },
            soldAtPrivateSaleCount: {
              $sum: {
                $cond: {
                  if: { $eq: ["$itemStocks.type", "sold-at-private-sale"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            soldAtPublicAuctionCount: {
              $sum: {
                $cond: {
                  if: { $eq: ["$itemStocks.type", "sold-at-public-auction"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            transferredWithoutCostCount: {
              $sum: {
                $cond: {
                  if: { $eq: ["$itemStocks.type", "transferred-without-cost"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            destroyedCount: {
              $sum: {
                $cond: {
                  if: { $eq: ["$itemStocks.type", "destroyed"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            createdAt: { $first: "$createdAt" },
          },
        },
      ];

      const pipelineForItems = [...pipeline, { $project: project }];

      const result = await collection.aggregate(pipelineForItems).toArray();

      return result[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateWasteById(_id: string | ObjectId, value: TWaste, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (typeof value.disposalApprovedBy === "string") {
      value.disposalApprovedBy = new ObjectId(value.disposalApprovedBy);
    }

    try {
      value.updatedAt = new Date().toISOString();
      await collection.updateOne({ _id }, { $set: value }, { session });
      return "Successfully updated waste.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createWaste,
    getWastes,
    getWasteById,
    updateWasteById,
  };
}
