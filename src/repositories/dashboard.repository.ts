import { logger, useAtlas } from "@ph-deped-ncr/utils";

export default function useDashboardRepo() {
  const atlas = useAtlas.getInstance();

  function useCollection(collectionName: string) {
    return atlas.getDb().collection(collectionName);
  }

  function extractCount(pipelineResult: any[], fieldName: string): number {
    return pipelineResult.length > 0 ? pipelineResult[0][fieldName] : 0;
  }

  async function getAssetsOverview() {
    try {
      const assetsCollection = useCollection("assets");
      const maintenanceCollection = useCollection("maintenances");
      const stocksCollection = useCollection("stocks");

      const totalAssetsPipeline = await assetsCollection.aggregate([{ $match: { deletedAt: null } }, { $count: "totalAssets" }]).toArray();
      const totalAssets = extractCount(totalAssetsPipeline, "totalAssets");

      const totalAssetsInUsePipeline = await stocksCollection
        .aggregate([
          { $match: { condition: "issued" } },
          {
            $lookup: {
              from: "stocks",
              let: { itemNo: "$itemNo", asset: "$assetId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $in: ["$condition", ["transferred", "lost", "stolen", "damaged", "destroyed", "for-disposal"]],
                        },
                        { $eq: ["$itemNo", "$$itemNo"] },
                        { $eq: ["$assetId", "$$asset"] },
                      ],
                    },
                  },
                },
                { $project: { _id: 0, itemNo: 1, assetId: 1, condition: 1 } },
              ],
              as: "statusMatch",
            },
          },
          { $match: { statusMatch: { $size: 0 } } },
          { $count: "totalAssetsInUse" },
        ])
        .toArray();
      const totalAssetsInUse = extractCount(totalAssetsInUsePipeline, "totalAssetsInUse");

      const totalAssetMaintenancePipeline = await maintenanceCollection
        .aggregate([{ $match: { status: { $nin: ["completed", "cancelled"] } } }, { $count: "totalAssetMaintenance" }])
        .toArray();
      const totalAssetMaintenance = extractCount(totalAssetMaintenancePipeline, "totalAssetMaintenance");

      const totalAssetsDisposedPipeline = await stocksCollection
        .aggregate([{ $match: { condition: "for-disposal" } }, { $count: "totalAssetsDisposed" }])
        .toArray();
      const totalAssetsDisposed = extractCount(totalAssetsDisposedPipeline, "totalAssetsDisposed");

      return { totalAssets, totalAssetsInUse, totalAssetMaintenance, totalAssetsDisposed };
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error in getAssetsOverview: ${error.message}`,
      });
      throw error;
    }
  }

  async function getAssetTypesOverview() {
    try {
      const assetsCollection = useCollection("assets");

      const totalConsumablesPipeline = await assetsCollection
        .aggregate([{ $match: { type: "consumable", deletedAt: null } }, { $count: "totalConsumables" }])
        .toArray();
      const totalConsumables = extractCount(totalConsumablesPipeline, "totalConsumables");

      const totalSEPPipeline = await assetsCollection.aggregate([{ $match: { type: "SEP", deletedAt: null } }, { $count: "totalSEP" }]).toArray();
      const totalSEP = extractCount(totalSEPPipeline, "totalSEP");

      const totalPPEPipeline = await assetsCollection.aggregate([{ $match: { type: "PPE", deletedAt: null } }, { $count: "totalPPE" }]).toArray();
      const totalPPE = extractCount(totalPPEPipeline, "totalPPE");

      return { totalConsumables, totalSEP, totalPPE };
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error in getAssetTypesOverview: ${error.message}`,
      });
      throw error;
    }
  }

  async function getPropertyConditions() {
    try {
      const assetsCollection = useCollection("assets");

      const buildPipeline = (assetType: string) => [
        { $match: { type: assetType } },
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
                  condition: { $in: ["issued", "transferred", "returned", "for-disposal", "lost", "stolen", "damaged", "destroyed"] },
                },
              },
              { $group: { _id: { assetId: "$assetId", condition: "$condition" }, totalOuts: { $sum: "$outs" }, totalIns: { $sum: "$ins" } } },
              {
                $group: {
                  _id: "$_id.assetId",
                  reissuedTotal: { $sum: { $cond: [{ $eq: ["$_id.condition", "issued"] }, "$totalOuts", 0] } },
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
            as: "issued",
          },
        },
        { $unwind: { path: "$issued", preserveNullAndEmptyArrays: true } },
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
        { $unwind: { path: "$forDisposal", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "stocks",
            let: { assetId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$assetId", "$$assetId"] }, condition: "transferred" } },
              { $group: { _id: "$assetId", totalOuts: { $sum: "$outs" } } },
            ],
            as: "transferred",
          },
        },
        { $unwind: { path: "$transferred", preserveNullAndEmptyArrays: true } },
        {
          $set: {
            goodCondition: { $subtract: ["$quantity", { $size: "$goodCondition" }] },
            issued: "$issued.finalTotalOuts",
            returned: "$returned.totalIns",
            forDisposal: "$forDisposal.totalOuts",
            transferred: "$transferred.totalOuts",
          },
        },
        {
          $project: {
            goodCondition: 1,
            issued: 1,
            returned: 1,
            forDisposal: 1,
            transferred: 1,
          },
        },
      ];

      const sepConditions = await assetsCollection.aggregate(buildPipeline("SEP")).toArray();
      const ppeConditions = await assetsCollection.aggregate(buildPipeline("PPE")).toArray();

      // Function to combine the quantities
      function combineQuantities(sepConditions: any, ppeConditions: any) {
        const sep = {
          goodCondition: 0,
          issued: 0,
          returned: 0,
          forDisposal: 0,
          transferred: 0,
        };

        const ppe = {
          goodCondition: 0,
          issued: 0,
          returned: 0,
          forDisposal: 0,
          transferred: 0,
        };

        // Combine sepConditions
        sepConditions.forEach((sepCondition: any) => {
          sep.goodCondition += sepCondition.goodCondition || 0;
          sep.issued += sepCondition.issued || 0;
          sep.returned += sepCondition.returned || 0;
          sep.forDisposal += sepCondition.forDisposal || 0;
          sep.transferred += sepCondition.transferred || 0;
        });

        // Combine ppeConditions
        ppeConditions.forEach((ppeCondition: any) => {
          ppe.goodCondition += ppeCondition.goodCondition || 0;
          ppe.issued += ppeCondition.issued || 0;
          ppe.returned += ppeCondition.returned || 0;
          ppe.forDisposal += ppeCondition.forDisposal || 0;
          ppe.transferred += ppeCondition.transferred || 0;
        });

        return { sepConditions: sep, ppeConditions: ppe };
      }

      const { sepConditions: sepResult, ppeConditions: ppeResult } = combineQuantities(sepConditions, ppeConditions);

      return { sepConditions: sepResult, ppeConditions: ppeResult };
    } catch (error) {
      console.error("Error fetching property conditions:", error);
      throw error;
    }
  }

  async function getRecentActivities() {
    try {
      const stocksCollection = useCollection("stocks");

      const recentActivitiesPipeline = await stocksCollection
        .aggregate([
          {
            $lookup: {
              from: "assets",
              localField: "assetId",
              foreignField: "_id",
              as: "asset",
              pipeline: [
                { $match: { deletedAt: null } },
                {
                  $project: {
                    name: 1,
                    type: 1,
                    createdAt: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$asset", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              name: "$asset.name",
              type: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$asset.type", "consumable"] }, then: "Consumables" },
                    { case: { $eq: ["$asset.type", "SEP"] }, then: "Semi-Expendable Property" },
                    { case: { $eq: ["$asset.type", "PPE"] }, then: "Property, Plant and Equipment" },
                  ],
                  default: "$asset.type",
                },
              },
              createdAt: "$asset.createdAt",
              condition: 1,
            },
          },
          { $sort: { createdAt: -1 } },
        ])
        .toArray();

      return { recentActivities: recentActivitiesPipeline };
    } catch (error: any) {
      logger.log({
        level: "error",
        message: `Error in getRecentActivities: ${error.message}`,
      });
      throw error;
    }
  }

  return { getAssetsOverview, getAssetTypesOverview, getPropertyConditions, getRecentActivities };
}
