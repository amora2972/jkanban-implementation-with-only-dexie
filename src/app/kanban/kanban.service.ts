import {Injectable} from '@angular/core';
import {kanbanDb} from './kanbandb';
import {IColumn} from './interfaces/column.interface';
import {ITicket} from './interfaces/ticket.interface';

@Injectable({
  providedIn: 'root'
})

// service for indexed db using the dexie library
export class KanbanService {
  limitOfTickets = 2;

  /*
  * returns all columns with their tickets from indexed db
  * */
  async fetchColumns(): Promise<IColumn[]> {
    const columns: IColumn[] = await kanbanDb.columns.toArray();

    return Promise.all(columns.map(async (col: IColumn) => {
      const table = kanbanDb.tickets;
      const collection = table
        .where('columnId').anyOf(+col.id);
      const ORDER_BY = 'order';

      const primaryKeySet = new Set(await collection.primaryKeys());

      const pageKeys = [];
      await table.orderBy(ORDER_BY)
        .until(() => pageKeys.length === this.limitOfTickets)
        .eachPrimaryKey(id => {
          if (primaryKeySet.has(id)) {
            pageKeys.push(id);
          }
        });

      col.item = await Promise.all(pageKeys.map(id => table.get(id)));
      col.totalTicketsLeft = await collection.count() - col.item.length;

      return col;
    })).then((cols: IColumn[]) => cols);
  }

  /**
   *
   * @param columnId
   * @param offset
   */
  async fetchColumnWithTickets(columnId: number, offset: number): Promise<IColumn> {
    const column: IColumn = await kanbanDb.columns.get(columnId);

    const table = kanbanDb.tickets;
    const collection = table
      .where('columnId').anyOf(columnId);

    column.item = await table
      .where('order').above(offset - 1).and((item: ITicket) => +item.columnId === columnId).sortBy('order');
    column.totalTicketsLeft = await collection.count() - (offset + column.item.length);
    return column;
  }

  /*
  * @parameters:
  * id of the ticket.
  * returns the corresponding ticket of the given id from indexed db
  * */
  async fetchTicket(id: any): Promise<ITicket> {
    return await kanbanDb.tickets.get(+id);
  }

  /*
  * @parameters:
  * ticket: to be stored
  * stores a given ticket in indexed db
  * */
  async storeTicket(ticket: ITicket): Promise<ITicket> {
    const ticketId = await kanbanDb.tickets.add(ticket);
    return (await this.fetchTicket(ticketId));
  }

  /*
  * @parameters
  * ticket: to be updated
  * updates a specific ticket in indexed db
  * returns the updated ticket from indexed db
  * */
  async updateTicket(ticket: ITicket): Promise<ITicket> {
    ticket.id = +ticket.id;
    const isUpdated = await kanbanDb.tickets.update(ticket.id, ticket);
    return (await this.fetchTicket(ticket.id));
  }

  /*
  * @parameters:
  * delete an element based on the given id from indexed db
  * */
  async destroyElement(id: any): Promise<number> {
    const isDestroyed = (await kanbanDb.tickets.where('id').anyOf(+id).delete());
    return id;
  }

  /*
  * this method will make a batch update which will update
  * all the elements in the received tickets array
  * */
  async batchUpdate(tickets: ITicket[]) {
    await kanbanDb.tickets.bulkPut(tickets);
    return tickets;
  }

  async regenerateByIncrement(columnId: number, ticket: ITicket) {
    const table = kanbanDb.tickets;
    const collection = await table.where('order').aboveOrEqual(ticket.order).and(item => item.columnId === columnId).sortBy('order');

    const tickets = [];
    collection.forEach((item: ITicket, index: number) => {
      if (+item.id !== +ticket.id) {
        item.id = +item.id;
        item.columnId = +item.columnId;
        if (item.order === ticket.order) {
          item.order += 1;
        } else {
          item.order = ticket.order + index;
        }
        tickets.push(item);
      }
    });
    this.batchUpdate(tickets);
  }

  async regenerateByDecrement(columnId: number, ticket: ITicket) {
    const table = kanbanDb.tickets;
    const collection = await table.where('columnId').anyOf(columnId).and(item => item.order > ticket.order).sortBy('order');
    const tickets = [];
    console.log({collection});
    collection.forEach((item: ITicket, index: number) => {
      if (+item.id !== +ticket.id) {
        item.id = +item.id;
        item.columnId = +item.columnId;
        item.order -= 1;
        tickets.push(item);
      }
    });
    this.batchUpdate(tickets);
  }
}
