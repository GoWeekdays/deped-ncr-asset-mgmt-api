import { ClientSession, ObjectId } from "mongodb";
import { BadRequestError, InternalServerError, logger, paginate, useAtlas } from "@ph-deped-ncr/utils";
import { MUser, TUser } from "../models/user.model";
import { concatenateName } from "./../local-utils";

export function useUserRepo() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("users");
  const risCollection = atlas.getDb().collection("ris");
  const returnCollection = atlas.getDb().collection("returns");

  async function createIndex() {
    try {
      await collection.createIndexes([{ key: { type: 1 } }, { key: { designation: 1 } }]);

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ type: 1, email: 1, deletedAt: 1 }, { unique: true, name: "UniqueIndex" });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ firstName: "text", lastName: "text", email: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUser(value: TUser, session?: ClientSession) {
    const user = new MUser(value);

    try {
      const existingUser = await collection.findOne({ type: value.type, email: value.email, deletedAt: null });
      if (existingUser) {
        throw new BadRequestError("Email already exists.");
      }

      return await collection.insertOne(user, { session });
    } catch (error: any) {
      logger.log({ level: "error", message: `${error}` });

      const isDuplicated = error.message.includes("duplicate");
      if (isDuplicated) {
        throw new BadRequestError("Email already exists.");
      }

      throw error;
    }
  }

  async function getUsers({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      createdAt: 1,
      email: 1,
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
      officeId: 1,
      officeName: "$office.name",
      divisionId: 1,
      divisionName: "$division.name",
      type: 1,
      designation: 1,
      status: 1,
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

  async function getUsersByType({ page = 1, limit = 10, sort = {}, search = "", type = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };
    query.type = type;

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      createdAt: 1,
      email: 1,
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
      officeId: 1,
      officeName: "$office.name",
      divisionId: 1,
      divisionName: "$division.name",
      type: 1,
      status: 1,
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

  async function getUserByEmail(email: string) {
    try {
      return await collection.findOne<TUser>({ email });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to get user by email.");
    }
  }

  async function getUserById(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    const project = {
      createdAt: 1,
      email: 1,
      title: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      suffix: 1,
      officeId: 1,
      officeName: "$office.name",
      divisionId: 1,
      divisionName: "$division.name",
      type: 1,
      designation: 1,
      status: 1,
      attachment: 1,
      password: 1,
    };

    const pipeLine = [
      { $match: { _id } },
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
      const data = await collection.aggregate(pipeLine).toArray();
      return data[0] ? (data[0] as TUser) : null;
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateUser(_id: string | ObjectId, value: Partial<TUser>, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    if (value.officeId) {
      if (typeof value.officeId === "string") {
        value.officeId = new ObjectId(value.officeId);
      }
    }

    if (value.divisionId) {
      if (typeof value.divisionId === "string") {
        value.divisionId = new ObjectId(value.divisionId);
      }
    }

    const updatedUser = { ...value, updatedAt: new Date().toISOString() };

    const name = concatenateName(updatedUser?.title, updatedUser?.firstName, updatedUser?.middleName, updatedUser?.lastName, updatedUser?.suffix);

    try {
      const existingUser = await collection.findOne({ type: value.type, email: value.email, _id: { $ne: _id }, deletedAt: null });
      if (existingUser) {
        throw new BadRequestError("Email already exists.");
      }

      const updateOptions = session ? { session } : {};

      await collection.updateOne({ _id }, { $set: updatedUser }, updateOptions);

      if (value.title || value.firstName || value.lastName || value.suffix) {
        await risCollection.updateMany({ requestedBy: _id }, { $set: { requestedByName: name } }, updateOptions);
        await returnCollection.updateMany({ returnedBy: _id }, { $set: { returnedByName: name } }, updateOptions);
      }

      return "Successfully updated user.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updatePassword(_id: string | ObjectId, password: string, session?: ClientSession) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.updateOne({ _id }, { $set: { password, updatedAt: new Date().toISOString() } }, { session });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function updateUserStatus(_id: string | ObjectId, status: string) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.updateOne({ _id }, { $set: { status } });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to update user status.");
    }
  }

  async function deleteUser(_id: string | ObjectId) {
    if (typeof _id === "string") {
      _id = new ObjectId(_id);
    }

    try {
      return await collection.deleteOne({ _id });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getPersonnelList({ page = 1, limit = 10, sort = {}, search = "" } = {}) {
    page = page > 0 ? page - 1 : 0;

    const query: any = { deletedAt: null };

    sort = Object.keys(sort).length > 0 ? sort : { name: 1 };

    if (search) {
      query.$text = { $search: search };
    }

    const project = {
      _id: 1,
      name: 1,
      email: 1,
      type: 1,
      status: 1,
    };

    const pipeLine = [
      { $match: query },
      {
        $project: {
          _id: 1,
          name: {
            $concat: [
              { $cond: [{ $ifNull: ["$title", false] }, { $concat: ["$title", " "] }, ""] },
              "$firstName",
              " ",
              "$lastName",
              { $cond: [{ $ifNull: ["$suffix", false] }, { $concat: [" ", "$suffix"] }, ""] },
            ],
          },
          email: 1,
          type: 1,
          status: 1,
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

  return {
    createIndex,
    createUniqueIndex,
    createUser,
    getUsers,
    getUsersByType,
    getUserByEmail,
    getUserById,
    updateUser,
    updatePassword,
    updateUserStatus,
    deleteUser,
    getPersonnelList,
    createSearchIndex,
  };
}
