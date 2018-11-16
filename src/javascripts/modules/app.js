var includes = require('lodash/includes');

class App {
  constructor(client) {
    this._client = client

    this.initializePromise = this.init()
  }

  /**
   * Initialize module
   */
  async settings(label) {
    let setting_values = (await this._client.metadata()).settings[label];
    return ((setting_values || "").split(',')).filter(Boolean);
  };

  /**
   * Initialize module
   */
  contains(collection, values) {
    if (typeof values !== "object")
      return includes(collection, values);

    let flattened_contains = values.reduce((result, value) => {
      result.push(includes(collection, value));
      return result;
    }, []);
    return flattened_contains.some(Boolean);
  };

  /**
   * Initialize module
   */
  async currentUserIsTarget(user) {
    const rules = [
      ['targeted_user_ids', String(user.id)],
      ['targeted_user_tags', user.tags],
      ['targeted_organization_ids', user.organizations.map((org) => {
        return String(org.id);
      })],
      ['targeted_group_ids', user.groups.map((group) => {
        return String(group.id);
      })]
    ];

    const pArray = rules.map(n => this.funcOne(n));
    const results = await Promise.all(pArray);
    const isTarget = results.some((res) => {
      return res === true;
    });
    return isTarget;
  };

  /**
   * Initialize module
   */
  async funcOne(rule) {
    const setting_values = await this.settings(rule[0]);
    return this.contains(setting_values, rule[1]);
  }

  /**
   * Initialize module
   */
  async hideAssigneeOptions() {
    const group_ids = await this.settings('hidden_group_ids');
    const user_ids = await this.settings('hidden_user_ids');

    const assigneeOptions = (await this._client.get('ticketFields:assignee'))['ticketFields:assignee'];

    assigneeOptions.optionGroups.forEach((option, index) => {
      const group_id = option.value;

      if (this.contains(group_ids, group_id)) {
        this._client.invoke('ticketFields:assignee.optionGroups.' + index + '.hide');
      }
    });

    assigneeOptions.optionValues.forEach((option, index) => {
      const group_and_user = option.value.split(':'),
        user_id = group_and_user[1] || "";

      if (this.contains(user_ids, user_id)) {
        this._client.invoke('ticketFields:assignee.optionValues.' + index + '.hide');
      }
    });
  };

  /**
   * Initialize module
   */
  async init() {
    const currentUser = (await this._client.get('currentUser')).currentUser;

    if (await this.currentUserIsTarget(currentUser)) {
      return this.hideAssigneeOptions();
    };
  }

}

export default App