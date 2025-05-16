import { logger, NotFoundError, useAtlas } from "@ph-deped-ncr/utils";
import { TMaintenance } from "./../models/maintenance.model";
import { ClientSession } from "mongodb";
import useMaintenanceRepository from "./../repositories/maintenance.repository";
import { useUserRepo } from "./../repositories/user.repository";
import useCounterRepository from "./../repositories/counter.repository";
import useStockRepository from "./../repositories/stock.repository";
import useOfficeService from "./office.service";
import useAssetRepository from "./../repositories/asset.repository";

export default function useMaintenanceService() {
  const {
    createMaintenance: _createMaintenance,
    getMaintenances: _getMaintenances,
    getMaintenanceById: _getMaintenanceById,
    updateMaintenanceById: _updateMaintenanceById,
  } = useMaintenanceRepository();
  const { getUserById } = useUserRepo();
  const { incrementCounterByType: _incrementCounterByType } = useCounterRepository();
  const { getStockById } = useStockRepository();
  const { getOfficeById } = useOfficeService();
  const { getAssetById } = useAssetRepository();

  const atlas = useAtlas.getInstance();

  async function createMaintenance({ stockId = "", assigneeId = "", issue = "" }: TMaintenance) {
    let count = 0;
    let code = "";

    const stock = await getStockById(stockId.toString());
    if (!stock) {
      throw new NotFoundError("Stock not found.");
    }

    const asset = await getAssetById(stock.assetId.toString());
    if (!asset) {
      throw new NotFoundError("Asset not found.");
    }

    const assignee = await getUserById(assigneeId.toString());
    if (!assignee) {
      throw new NotFoundError("Assignee not found.");
    }

    const office = await getOfficeById(assignee.officeId?.toString() ?? "");
    if (!office) {
      throw new NotFoundError("Office not found.");
    }

    try {
      const counter = await _incrementCounterByType("maintenance");
      if (!counter) {
        throw new NotFoundError("Counter not found.");
      }
      count = counter.value as number;

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const _count = count.toString().padStart(2, "0");

      code = `MNT-${year}-${month}-${day}-${_count}`;

      return await _createMaintenance({
        stockId,
        code,
        name: asset?.name,
        officeName: office?.name,
        assigneeId,
        issue,
      });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getMaintenances({ page = 1, limit = 10, sort = {}, search = "", role = "", userId = "" } = {}) {
    try {
      const user = await getUserById(userId);
      if (!user) {
        throw new NotFoundError("User not found.");
      }

      const officeId = user.officeId?.toString() ?? "";

      const office = await getOfficeById(officeId);
      if (!office) {
        throw new NotFoundError("Office not found.");
      }

      return await _getMaintenances({ page, limit, sort, search, role, officeId });
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching maintenance: ${(error as Error).message}` });
      throw error;
    }
  }

  async function getMaintenanceById(_id: string) {
    try {
      const maintenance = await _getMaintenanceById(_id);
      if (!maintenance) {
        throw new NotFoundError(`Maintenance with ID ${_id} not found.`);
      }

      return maintenance;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching maintenance by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateMaintenanceById(_id: string, value: TMaintenance, session?: ClientSession) {
    const maintenance = await _getMaintenanceById(_id);
    if (!maintenance) {
      throw new NotFoundError("Maintenance not found.");
    }

    try {
      if (value.completedBy) {
        const completedBy = await getUserById(value.completedBy);
        if (!completedBy) {
          throw new NotFoundError("Personnel not found.");
        }
      }

      await _updateMaintenanceById(_id, value, session);
      return "Successfully updated maintenance.";
    } catch (error) {
      logger.log({ level: "error", message: `Error updating maintenance by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  return {
    createMaintenance,
    getMaintenances,
    getMaintenanceById,
    updateMaintenanceById,
  };
}
