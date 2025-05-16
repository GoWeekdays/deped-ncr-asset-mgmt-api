import { ObjectId } from "mongodb";
import { logger, NotFoundError } from "@ph-deped-ncr/utils";
import { TSchool } from "./../models/school.model";
import useSchoolRepository from "./../repositories/school.repository";
import useSchoolDivisionRepository from "./../repositories/school-division.repository";

export default function useSchoolService() {
  const {
    createSchool: _createSchool,
    getSchools: _getSchools,
    getSchoolById: _getSchoolById,
    updateSchool: _updateSchool,
    deleteSchool: _deleteSchool,
  } = useSchoolRepository();
  const { getSchoolDivisionById } = useSchoolDivisionRepository();

  async function createSchool({ name, divisionId }: { name: string; divisionId: string }) {
    try {
      if (divisionId) {
        const division = await getSchoolDivisionById(divisionId);
        if (!division) {
          throw new NotFoundError("School division not found.");
        }
      }

      await _createSchool({ name, divisionId });
      return "Successfully created school.";
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function findOrCreateSchool(schoolIdOrName: string, divisionId?: string | ObjectId) {
    try {
      const isObjectId = ObjectId.isValid(schoolIdOrName);

      let school: TSchool | null = null;

      if (isObjectId) {
        // Retrieve school by ID
        const foundSchool = await _getSchoolById(schoolIdOrName);
        if (foundSchool && foundSchool._id) {
          school = {
            _id: foundSchool._id.toString(),
            name: foundSchool.name,
            divisionId: foundSchool.divisionId || "",
          } as TSchool;
        }
      } else {
        // Search for school by name
        const schools = await _getSchools({ search: schoolIdOrName });
        const matchedSchool = schools.items.find((s: TSchool) => s.name === schoolIdOrName);
        if (matchedSchool) {
          school = {
            _id: matchedSchool._id.toString(),
            name: matchedSchool.name,
            divisionId: matchedSchool.divisionId || "",
          };
        }
      }

      if (school) {
        return { _id: school._id?.toString(), name: school.name, divisionId: school.divisionId?.toString() };
      }

      // Validate divisionId if provided
      if (divisionId) {
        const division = await getSchoolDivisionById(divisionId);
        if (!division) {
          throw new NotFoundError("School division not found.");
        }
      }

      // Add a new school
      const newSchool: TSchool = { name: schoolIdOrName, divisionId: divisionId || "" };
      const result = await _createSchool(newSchool);

      if (result) {
        school = {
          _id: result._id.toString(),
          name: result.name,
          divisionId: result.divisionId || "",
        } as TSchool;
        if (school) {
          return { _id: school._id?.toString(), name: school.name, divisionId: school.divisionId?.toString() };
        }
      }
    } catch (error) {
      logger.log({
        level: "error",
        message: `Error in find or create school: ${(error as Error).message}`,
      });

      throw error;
    }
  }

  async function getSchools({ page = 1, limit = 10, sort = {}, search = "", divisionId = "" } = {}) {
    try {
      return await _getSchools({ page, limit, sort, search, divisionId });
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function getSchoolById(id: string) {
    try {
      const school = await _getSchoolById(id);
      if (!school) {
        throw new NotFoundError("School not found.");
      }

      return school;
    } catch (error) {
      logger.log({ level: "error", message: `Error fetching school by ID: ${(error as Error).message}` });
      throw error;
    }
  }

  async function updateSchool(id: string, value: TSchool) {
    const school = await _getSchoolById(id);
    if (!school) {
      throw new NotFoundError("School not found.");
    }

    if (value.divisionId) {
      const division = await getSchoolDivisionById(value.divisionId);
      if (!division) {
        throw new NotFoundError("School division not found.");
      }
    }

    try {
      return await _updateSchool(id, value);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  async function deleteSchool(id: string) {
    const school = await _getSchoolById(id);
    if (!school) {
      throw new NotFoundError("School not found.");
    }

    try {
      return await _deleteSchool(id);
    } catch (error) {
      logger.log({ level: "error", message: `${error}` });
      throw error;
    }
  }

  return {
    createSchool,
    findOrCreateSchool,
    getSchools,
    getSchoolById,
    updateSchool,
    deleteSchool,
  };
}
