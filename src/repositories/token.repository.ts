import { ClientSession } from "mongodb";
import { InternalServerError, logger, useAtlas } from "@ph-deped-ncr/utils";
import { MToken, TToken } from "../models/token.model";

export function useTokenRepo() {
  const atlas = useAtlas.getInstance();
  const collection = atlas.getDb().collection("tokens");

  async function createIndex() {
    try {
      await collection.createIndex({ token: 1 });

      return "Successfully created index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createUniqueIndex() {
    try {
      await collection.createIndex({ token: 1 }, { name: "UniqueIndex", unique: true });

      return "Successfully created unique index.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function createToken(value: TToken, session?: ClientSession) {
    const token = new MToken(value);

    try {
      await collection.insertOne(token, { session });
      return "Token created";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to create token.");
    }
  }

  async function getToken(token: string) {
    try {
      return await collection.findOne({ token });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to find token.");
    }
  }

  async function deleteToken(token: string) {
    try {
      return await collection.deleteOne({ token });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw new InternalServerError("Failed to delete token.");
    }
  }

  return { createIndex, createUniqueIndex, createToken, getToken, deleteToken };
}
