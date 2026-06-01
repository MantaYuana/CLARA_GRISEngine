import { axiosInstance } from "../lib/axios";
// ─── Dummy Data ───────────────────────────────────────────────────────────────
// Replace this with real API calls once backend is ready.
// The shape of each object here matches the expected API response shape.
export const DUMMY_PROJECTS = [
  {
    id: "1",
    title: "Perjanjian Kerja PT Maju Bersama",
    description:
      "Analisa kontrak kerja waktu tertentu untuk posisi Senior Developer",
    sourcesCount: 2,
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 jam lalu
  },
  {
    id: "2",
    title: "NDA — PT Teknologi Nusantara",
    description: "Non-disclosure agreement untuk project kolaborasi Q1 2026",
    sourcesCount: 1,
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 jam lalu
  },
  {
    id: "3",
    title: "Lease Agreement Gudang Cikarang",
    description: "Perjanjian sewa gudang untuk operasional logistik 2026-2028",
    sourcesCount: 3,
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 hari lalu
  },
  {
    id: "4",
    title: "Service Level Agreement — Cloud Hosting",
    description: "SLA untuk layanan cloud hosting dan maintenance support",
    sourcesCount: 1,
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 hari lalu
  },
  {
    id: "5",
    title: "Kontrak Distribusi CV Karya Mandiri",
    description:
      "Perjanjian distribusi eksklusif produk FMCG wilayah Jawa Tengah",
    sourcesCount: 2,
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 hari lalu
  },
  {
    id: "6",
    title: "MOU Kerjasama Riset Universitas",
    description:
      "Memorandum of understanding untuk kerjasama riset teknologi AI",
    sourcesCount: 4,
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 hari lalu
  },
];
// ─── Service Functions ────────────────────────────────────────────────────────
// Swap the return value from DUMMY_PROJECTS to the axios call to enable real API.
/**
 * Fetch all projects for the authenticated user.
 * @returns {Promise<Array>}
 */
export const fetchProjects = async () => {
  // TODO: uncomment when backend is ready
  // const response = await axiosInstance.get("/api/v1/projects");
  // return response.data;
  // Simulate network delay for realistic feel during development
  await new Promise((resolve) => setTimeout(resolve, 300));
  return DUMMY_PROJECTS;
};
/**
 * Create a new project.
 * @param {Object} payload - { title, description }
 * @returns {Promise<Object>}
 */
export const createProject = async (payload) => {
  // TODO: uncomment when backend is ready
  // const response = await axiosInstance.post("/api/v1/projects", payload);
  // return response.data;
  const newProject = {
    id: String(Date.now()),
    title: payload.title || "New Project",
    description: payload.description || "",
    sourcesCount: 0,
    updatedAt: new Date().toISOString(),
  };
  return newProject;
};

/**
 * Rename an existing project.
 * @param {string} id
 * @param {string} newTitle
 * @returns {Promise<void>}
 */
export const renameProject = async (id, newTitle) => {
  // TODO: uncomment when backend is ready
  // await axiosInstance.patch(`/api/v1/projects/${id}`, { title: newTitle });
  await new Promise((r) => setTimeout(r, 150));
};

/**
 * Delete a project.
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteProject = async (id) => {
  // TODO: uncomment when backend is ready
  // await axiosInstance.delete(`/api/v1/projects/${id}`);
  await new Promise((r) => setTimeout(r, 150));
};
