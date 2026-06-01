import { HiOutlinePlus } from "react-icons/hi2";

const EmptyState = ({ searchQuery, onCreate }) => {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
      {searchQuery ? (
        <>
          <p className="text-textPrimary font-medium">Tidak ada hasil untuk</p>
          <p className="text-primary font-semibold text-lg">"{searchQuery}"</p>
          <p className="text-textSecondary text-sm">
            Coba kata kunci yang berbeda
          </p>
        </>
      ) : (
        <>
          <p className="text-textPrimary font-medium">Belum ada proyek</p>
          <p className="text-textSecondary text-sm">
            Mulai dengan membuat proyek pertamamu
          </p>

          <button
            onClick={onCreate}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium
                       bg-primary text-white rounded-lg
                       hover:bg-primary/80 transition-colors duration-200"
          >
            <HiOutlinePlus className="text-base" />
            Buat Proyek Baru
          </button>
        </>
      )}
    </div>
  );
};

export default EmptyState;
