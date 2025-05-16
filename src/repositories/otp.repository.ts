import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, InternalServerError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MOneTimePassword, TOneTimePassword } from "../models/otp.model";

export function useOTPRepo() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("oneTimePasswords");

  async function createIndex() {
    try {
      await collection.createIndex({ type: 1 });

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ email: "text", userType: "text", status: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createOTP(value: TOneTimePassword, session?: ClientSession) {
    const otp = new MOneTimePassword(value);
    try {
      const res = await collection.insertOne(otp, { session });
      return res.insertedId.toString();
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to create OTP.");
    }
  }

  async function getOTPById(_id: string | ObjectId, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      createdAt: 1,
      type: 1,
      email: 1,
      officeId: 1,
      officeName: "$office.name",
      divisionId: 1,
      divisionName: "$division.name",
      status: 1,
      userType: 1,
    };

    const pipeLine = [
      { $match: { _id, status: { $nin: ["cancelled", "accepted"] } } },
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
      { $project: project },
    ];

    try {
      const data = await collection.aggregate(pipeLine, { session }).toArray();
      return data[0];
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to find OTP by ID.");
    }
  }

  async function getOTPByType({ page = 1, limit = 10, sort = {}, search = "", type = "", otp = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = {};
    query.type = type;

    sort = Object.keys(sort).length > 0 ? sort : { _id: -1 };

    if (search) {
      query.$text = { $search: search };
    }

    if (otp) {
      query.otp = otp;
    }

    const project = {
      createdAt: 1,
      email: 1,
      officeId: 1,
      officeName: "$office.name",
      divisionId: 1,
      divisionName: "$division.name",
      status: 1,
      userType: 1,
    };

    const pipeLine = [
      { $match: query },
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

  async function getOTPBySixDigits(otp: string) {
    try {
      return await collection.findOne({ otp, type: "update-email", status: "pending" });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to find 6-digit OTP.");
    }
  }

  async function updateOTPStatus(_id: string | ObjectId, status: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.updateOne({ _id }, { $set: { status, updatedAt: new Date().toISOString() } }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to update OTP status.");
    }
  }

  return {
    createIndex,
    createSearchIndex,
    createOTP,
    getOTPById,
    getOTPByType,
    getOTPBySixDigits,
    updateOTPStatus,
  };
}
