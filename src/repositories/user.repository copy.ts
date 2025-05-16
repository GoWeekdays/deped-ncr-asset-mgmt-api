import { ObjectId } from "mongodb";
import { BadRequestError, InternalServerError, logger, useAtlas } from "@ph-deped-ncr/utils";
import { TUser } from "./../models/user.model";

export function useUserRepo() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("users");

  async function getUserById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new BadRequestError("Invalid user ID.");
    }

    try {
      return await collection.findOne<TUser>({ _id });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to get user by email.");
    }
  }

  async function createSearchIndex() {
    try {
      await collection.createIndex({ name: "text", email: "text" }, { name: "TextSearch" });

      return "Successfully created search index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    getUserById,
    createSearchIndex,
  };
}
