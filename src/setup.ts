import { initRedisClient } from "./redis";
import useFileService from "./services/file.service";

export default async () => {
  await initRedisClient()

  const { deleteDraft } = useFileService();

  deleteDraft()
};
