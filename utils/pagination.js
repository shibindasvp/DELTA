export const getPaginationData = ({ page = 1, limit = 10, totalItems = 0 }) => {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 10);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageLimit));
    const skip = (currentPage - 1) * pageLimit;

    const startItem = totalItems === 0 ? 0 : skip + 1;
    const endItem = totalItems === 0 ? 0 : Math.min(totalItems, skip + pageLimit);

    
    const pageNumbers = [];
    const delta = 2; 
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i <= right)) {
            pageNumbers.push(i);
        } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
            pageNumbers.push('...');
        }
    }

    return {
        currentPage,
        pageLimit,
        totalPages,
        totalItems,
        startItem,
        endItem,
        skip,
        pageNumbers,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null
    };
};
