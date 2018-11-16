var includes = require('lodash/includes');

class App {
  constructor(client) {
    this._client = client

    this.initializePromise = this.init()
  }

  /**
   * Retrieve setting value
   * @param {String} label the name of the setting we need the value for
   * @return {Promise} resolves to array of values for given setting
   */
  async settings(label) {
    let setting_values = (await this._client.metadata()).settings[label];
    return ((setting_values || "").split(',')).filter(Boolean);
  };

  /**
   * Check if values (for a user) exist in a collection (of setting values)
   * @param {Array} collection array of strings containing setting values
   * @param {Array || String} values user data values relating to id, tags, group or org as array 
   * @returns {Boolean} 
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
   * Establish if logged in user is affected by Assignment Control settings
   * @param {Object} user Zendesk user Object
   * @returns {Promise} resolves to Boolean
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

    const pArray = rules.map(n => this.userMatchesRule(n));
    const results = await Promise.all(pArray);
    const isTarget = results.some((res) => {
      return res === true;
    });
    return isTarget;
  };

  /**
   * Test if a rule applies to a user
   * @param {Array} rule array of arrays containing rule names and user data
   * @returns {Promise} resolves to Boolean
   */
  async userMatchesRule(rule) {
    const setting_values = await this.settings(rule[0]);
    return this.contains(setting_values, rule[1]);
  }

  /**
   * Hides assignee options
   * @returns nothing
   */
  async hideAssigneeOptions() {
    const group_ids = await this.settings('hidden_group_ids');
    const user_ids = await this.settings('hidden_user_ids');

    const assigneeOptions = (await this._client.get('ticketFields:assignee'))['ticketFields:assignee'];

    // hide assignee groups
    assigneeOptions.optionGroups.forEach((option, index) => {
      const group_id = option.value;

      if (this.contains(group_ids, group_id)) {
        this._client.invoke('ticketFields:assignee.optionGroups.' + index + '.hide');
      }
    });

    // hide assignee values (i.e. agents)
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