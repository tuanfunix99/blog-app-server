class QueryApi {
  query: any;
  options: any;

  constructor(query: any, options: any) {
    this.query = query;
    this.options = options;
  }

  search() {
    const querySearch =
      this.options.keyword.trim().length > 0
        ? {
            $or: [
              { username: { $regex: this.options.keyword, $options: "i" } },
              { email: { $regex: this.options.keyword, $options: "i" } },
            ],
          }
        : {};
    this.query = this.query.find(querySearch);
    return this;
  }

  filter() {
    this.query = this.query.find(this.options.filter);
    return this;
  }

  pagination() {
    const page = this.options.pagination.page
      ? this.options.pagination.page
      : 1;
    const perpage = this.options.pagination.perpage
      ? this.options.pagination.perpage
      : 4;
    const skip = perpage * (page - 1);
    this.query = this.query.limit(perpage).skip(skip);
    return this;
  }
}

export default QueryApi;
